import { type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type FocusEvent as ReactFocusEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, get, handleReply, type HistoryEntry, type Ticket, type Loop, type Me, type Playlist, type PlaylistTrack, post, setOwnerName, type SettingsData, type Song, type Track, attachSocket, type View } from "./api";
import { lang, switchLang, t } from "./i18n";
import * as Icon from "./icons";
import { Ambient, useAccent } from "./ambient";

type Tab = "player" | "playlists" | "history" | "settings";
type QueueItem = { query: string; title?: string; artist?: string | null; artwork?: string | null; durationMs?: number };
type Synced = View & { at: number };
type Command = { action: string; positionMs?: number; loop?: Loop; on?: boolean; id?: string; to?: number };

const message = (error: unknown) => t.errors[error instanceof ApiError ? error.message : "failed"] ?? t.errors.failed!;
const isLink = (text: string) => /^https?:\/\//.test(text.trim());
const LOOP_ORDER: Loop[] = ["off", "queue", "track"];
const BASE_TITLE = document.title;
const RETRY_MS = [1_000, 3_000, 10_000, 30_000];
const RESTART_WITHIN_MS = 3_000;
const LANGS = [{ code: "en", name: "English" }, { code: "es", name: "Español" }] as const;

const stamp = (view: View): Synced => ({ ...view, at: performance.now() });

function estimate(view: Synced, now: number): number {
  const duration = view.tracks[view.current]?.durationMs ?? 0;
  const position = view.paused || view.loading ? view.positionMs : view.positionMs + (now - view.at);
  return duration > 0 ? Math.min(position, duration) : position;
}

function predictAdd(view: Synced, item: QueueItem): Synced {
  const track: Track = { id: `pending-${crypto.randomUUID()}`, query: item.query, title: item.title ?? item.query, artist: item.artist ?? null, artwork: item.artwork ?? null, durationMs: item.durationMs ?? 0, url: null, requestedBy: "" };
  const now = performance.now();
  const tracks = [...view.tracks, track];
  if (view.active && view.current >= 0 && view.current < view.tracks.length) return { ...view, positionMs: estimate(view, now), at: now, tracks, autoplayNext: null };
  return { ...view, at: now, active: true, tracks, current: view.tracks.length, positionMs: 0, paused: false, loading: true, autoplayNext: null };
}

function predict(view: Synced, command: Command): Synced {
  const now = performance.now();
  const next: Synced = { ...view, positionMs: estimate(view, now), at: now };
  const upcoming = (index: number) => index > view.current;
  switch (command.action) {
    case "pause":
      return { ...next, paused: true };
    case "resume":
      return { ...next, paused: false };
    case "seek":
      return { ...next, positionMs: command.positionMs ?? 0, paused: false, loading: true };
    case "skip": {
      let current = view.current + 1;
      let tracks = view.tracks;
      if (current >= tracks.length && view.loop === "queue") current = 0;
      else if (current >= tracks.length && view.autoplayNext) tracks = [...tracks, view.autoplayNext];
      return { ...next, tracks, current, positionMs: 0, paused: false, loading: current < tracks.length, autoplayNext: null };
    }
    case "previous": {
      const current = next.positionMs <= RESTART_WITHIN_MS && view.current > 0 ? Math.min(view.current, view.tracks.length) - 1 : view.current;
      return { ...next, current, positionMs: 0, paused: false, loading: true };
    }
    case "loop":
      return { ...next, loop: command.loop ?? "off" };
    case "autoplay":
      return { ...next, autoplay: Boolean(command.on), autoplayNext: command.on ? view.autoplayNext : null };
    case "clear":
      return { ...next, tracks: view.tracks.slice(0, view.current + 1) };
    case "remove":
      return { ...next, tracks: view.tracks.filter((track, index) => !(track.id === command.id && upcoming(index))) };
    case "move": {
      const from = view.tracks.findIndex((track) => track.id === command.id);
      if (!upcoming(from)) return next;
      const tracks = [...view.tracks];
      const [track] = tracks.splice(from, 1);
      tracks.splice(Math.min(tracks.length, Math.max(view.current + 1, command.to ?? 0)), 0, track!);
      return { ...next, tracks };
    }
    case "stop":
      return { ...next, active: false };
  }
  return next;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

function artwork(source: { artwork?: string | null; url?: string | null; query?: string }, size: number): string | null {
  if (source.artwork) return source.artwork.replace(/=w\d+-h\d+/, `=w${size}-h${size}`);
  const id = (source.url ?? source.query ?? "").match(/[?&]v=([\w-]{11})/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/${size > 200 ? "hqdefault" : "mqdefault"}.jpg` : null;
}

function Art({ src, className }: { src: string | null; className: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return (
    <div className={`art ${className}`}>
      {src && !broken ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <Icon.Note size={className === "art-hero" ? 64 : 18} />}
    </div>
  );
}

function useView(boot: Me | null): { view: Synced | null; live: boolean; refresh: () => void; setView: (view: Synced) => void } {
  const enabled = Boolean(boot?.canPlay);
  const [view, setView] = useState<Synced | null>(null);
  const handoff = useRef(boot);
  handoff.current = boot;
  const [live, setLive] = useState(true);
  const refresh = useCallback(() => {
    get<View>("state").then((next) => setView(stamp(next)), () => undefined);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const first = { current: handoff.current?.live ?? null };
    if (handoff.current?.state) setView(stamp(handoff.current.state));
    let closed = false;
    let socket: WebSocket | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const later = () => {
      retry = setTimeout(() => void connect(), RETRY_MS[Math.min(failures++, RETRY_MS.length - 1)]);
    };
    const stopPolling = () => {
      if (poll) clearInterval(poll);
      poll = undefined;
    };
    const connect = async () => {
      try {
        const handed = first.current;
        first.current = null;
        const { ticket, url } = handed ?? (await get<Ticket>("ticket"));
        if (closed) return;
        const live = new WebSocket(`${url}?ticket=${encodeURIComponent(ticket)}`);
        socket = live;
        live.onopen = () => {
          failures = 0;
          attachSocket(live);
          setLive(true);
          stopPolling();
        };
        live.onmessage = (event) => {
          const message = JSON.parse(String(event.data)) as { type: "view"; view: View } | { type: "reply"; id: number; status: number; body: unknown };
          if (message.type === "view") setView(stamp(message.view));
          else handleReply(message);
        };
        live.onclose = () => {
          attachSocket(null);
          if (closed) return;
          if (failures > 0) setLive(false);
          refresh();
          if (!poll) poll = setInterval(refresh, 10_000);
          later();
        };
      } catch {
        if (!closed) later();
      }
    };
    if (!first.current) refresh();
    void connect();
    return () => {
      closed = true;
      attachSocket(null);
      socket?.close();
      stopPolling();
      if (retry) clearTimeout(retry);
    };
  }, [enabled, refresh]);
  return { view, live, refresh, setView };
}

async function enqueue(body: { items: QueueItem[] } | { input: string }): Promise<void> {
  const result = await post<{ ok: boolean; reason?: string }>("enqueue", body);
  if (!result.ok) throw new ApiError(result.reason ?? "failed");
}

const WARM_TOP_AFTER_MS = 600;

function useWarm(enabled: boolean): (song: Song) => void {
  const warmed = useRef(new Set<string>());
  return useCallback((song: Song) => {
    if (!enabled || warmed.current.has(song.videoId)) return;
    warmed.current.add(song.videoId);
    post("warm", { query: song.url }).catch(() => undefined);
  }, [enabled]);
}

const asItem = (song: Song): QueueItem => ({ query: song.url, title: song.title, artist: song.artist, artwork: song.artwork, durationMs: song.durationMs });

function SongRow({ song, done, disabled, onAdd, warm }: { song: Song; done: boolean; disabled: boolean; onAdd: () => void; warm: (song: Song) => void }) {
  return (
    <li className="song" onPointerEnter={() => warm(song)} onPointerDown={() => warm(song)} onFocus={() => warm(song)}>
      <Art src={artwork(song, 96)} className="art-md" />
      <div className="meta">
        <div className="name">{song.title}</div>
        <div className="sub">{[song.artist, song.album].filter(Boolean).join(" · ")}</div>
      </div>
      {song.plays && <span className="plays">{song.plays}</span>}
      {song.durationMs > 0 && <span className="len">{clock(song.durationMs)}</span>}
      <button className={`icon-btn ring ${done ? "done" : ""}`} aria-label={done ? `${t.added}: ${song.title}` : t.addToQueue(song.title)} disabled={disabled} onClick={onAdd}>{done ? <Icon.Check /> : <Icon.Plus />}</button>
    </li>
  );
}

const SETTLE_AFTER_TOUCH_MS = 4_000;

function useSteady<T>(path: string, seed: string) {
  const [items, setItems] = useState<T | null>(null);
  const [version, setVersion] = useState(0);
  const pending = useRef<T | null>(null);
  const inside = useRef(false);
  const touched = useRef(0);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const release = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current === null || inside.current) return;
    const wait = touched.current + SETTLE_AFTER_TOUCH_MS - Date.now();
    if (wait > 0) {
      timer.current = setTimeout(release, wait);
      return;
    }
    const next = pending.current;
    pending.current = null;
    if (loaded.current) setVersion((count) => count + 1);
    loaded.current = true;
    setItems(next);
  }, []);
  useEffect(() => {
    let current = true;
    const fetch = setTimeout(() => {
      get<T>(path).then((next) => {
        if (!current) return;
        pending.current = next;
        release();
      }, () => undefined);
    }, 300);
    return () => {
      current = false;
      clearTimeout(fetch);
    };
  }, [path, seed, release]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const hold = {
    onPointerEnter: (event: ReactPointerEvent) => {
      if (event.pointerType === "mouse") inside.current = true;
    },
    onPointerLeave: () => {
      inside.current = false;
      release();
    },
    onPointerDown: () => {
      touched.current = Date.now();
    },
    onFocus: () => {
      inside.current = true;
    },
    onBlur: (event: ReactFocusEvent) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      inside.current = false;
      release();
    },
  };
  return { items, version, hold };
}

function Suggestions({ seedKey, onPick, hidden }: { seedKey: string; onPick: (item: QueueItem) => Promise<void>; hidden: boolean }) {
  const { items: songs, version, hold } = useSteady<Song[]>("suggestions", seedKey);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const warm = useWarm(true);
  if (!songs?.length) return null;
  async function pick(song: Song) {
    setError(null);
    setAdded((previous) => new Set(previous).add(song.videoId));
    try {
      await onPick(asItem(song));
    } catch (failure) {
      setError(message(failure));
      setAdded((previous) => {
        const next = new Set(previous);
        next.delete(song.videoId);
        return next;
      });
    }
  }
  return (
    <section className="suggest-area" aria-label={t.suggested} hidden={hidden} {...hold}>
      <h2 className="label">{t.suggested}</h2>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className={`rows ${version ? "refreshed" : ""}`} key={version}>
        {songs.map((song) => <SongRow key={song.videoId} song={song} done={added.has(song.videoId)} disabled={added.has(song.videoId)} onAdd={() => void pick(song)} warm={warm} />)}
      </ul>
    </section>
  );
}

const RECENT_SHOWN = 20;

function RecentlyPlayed({ seedKey, current, onPick }: { seedKey: string; current: string | null; onPick: (item: QueueItem) => Promise<void> }) {
  const { items: entries, version, hold } = useSteady<HistoryEntry[]>("history", seedKey);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const warm = useWarm(true);
  const seen = new Set<string>(current ? [current] : []);
  const songs: Song[] = [];
  for (const entry of entries ?? []) {
    const url = entry.url ?? entry.query;
    const id = url.match(/[?&]v=([\w-]{11})/)?.[1];
    if (!id || seen.has(url)) continue;
    seen.add(url);
    songs.push({ videoId: id, url, title: entry.title, artist: entry.artist ?? "", album: null, durationMs: entry.durationMs, artwork: entry.artwork, plays: null });
    if (songs.length === RECENT_SHOWN) break;
  }
  if (!songs.length) return null;
  async function pick(song: Song) {
    setAdded((previous) => new Set(previous).add(song.videoId));
    await onPick(asItem(song)).catch(() => setAdded((previous) => {
      const next = new Set(previous);
      next.delete(song.videoId);
      return next;
    }));
  }
  return (
    <section className="recent-area" aria-label={t.playedBefore} {...hold}>
      <h2 className="label">{t.playedBefore}</h2>
      <ul className={`rows ${version ? "refreshed" : ""}`} key={version}>
        {songs.map((song) => <SongRow key={song.videoId} song={song} done={added.has(song.videoId)} disabled={added.has(song.videoId)} onAdd={() => void pick(song)} warm={warm} />)}
      </ul>
    </section>
  );
}

function SongSearch({ placeholder, onPick, onLink, warmUp, onActive }: { placeholder: string; onPick: (item: QueueItem) => Promise<void>; onLink: (input: string) => Promise<void>; warmUp?: boolean; onActive?: (active: boolean) => void }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<Song[] | null>(null);
  const [shown, setShown] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const warm = useWarm(Boolean(warmUp));
  const active = text.trim().length > 0;
  useEffect(() => onActive?.(active), [active, onActive]);
  const search = useCallback(async (query: string) => {
    const id = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const songs = await get<Song[]>(`search?q=${encodeURIComponent(query)}`);
      if (id === sequence.current) {
        setResults(songs);
        setShown(query);
      }
    } catch (failure) {
      if (id === sequence.current) setError(message(failure));
    }
    if (id === sequence.current) setLoading(false);
  }, []);
  useEffect(() => {
    const query = text.trim();
    if (isLink(query) || query.length < 2) {
      sequence.current++;
      setResults(null);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => void search(query), 250);
    return () => clearTimeout(timer);
  }, [text, search]);
  function clear() {
    setText("");
    setResults(null);
    setAdded(new Set());
    setError(null);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const query = text.trim();
    if (!query) return;
    if (!isLink(query)) return void search(query);
    setBusy("link");
    setError(null);
    try {
      await onLink(query);
      clear();
    } catch (failure) {
      setError(message(failure));
    }
    setBusy(null);
  }
  async function pick(song: Song) {
    setBusy(song.videoId);
    setError(null);
    setAdded((previous) => new Set(previous).add(song.videoId));
    try {
      await onPick(asItem(song));
    } catch (failure) {
      setError(message(failure));
      setAdded((previous) => {
        const next = new Set(previous);
        next.delete(song.videoId);
        return next;
      });
    }
    setBusy(null);
  }
  const stale = results !== null && shown !== text.trim();
  const top = stale ? undefined : results?.[0];
  useEffect(() => {
    if (!top) return;
    const timer = setTimeout(() => warm(top), WARM_TOP_AFTER_MS);
    return () => clearTimeout(timer);
  }, [top, warm]);
  return (
    <div className="search">
      <form role="search" onSubmit={(event) => void submit(event)} className="search-box">
        <Icon.Search />
        <input value={text} data-search aria-keyshortcuts="/" onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") clear(); }} placeholder={placeholder} aria-label={placeholder} enterKeyHint={isLink(text) ? "go" : "search"} />
        {isLink(text) && <button className="pill primary" disabled={busy === "link"}>{busy === "link" ? t.adding : t.addLink}</button>}
        {text && <button type="button" className="icon-btn small" aria-label={t.clearSearch} onClick={clear}><Icon.Close /></button>}
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {(loading || results) && (
        <section aria-label={t.songs} aria-busy={loading}>
          <h2 className="label">{loading && !results ? t.searching : t.songs}</h2>
          {results?.length === 0 && <p className="hint">{t.noSongs}</p>}
          <ul className={`rows ${stale ? "stale" : ""}`}>
            {results?.map((song) => <SongRow key={song.videoId} song={song} done={added.has(song.videoId)} disabled={stale || busy === song.videoId} onAdd={() => void pick(song)} warm={warm} />)}
          </ul>
        </section>
      )}
    </div>
  );
}

const SLIDER_KEYS: Record<string, number> = { ArrowLeft: -5_000, ArrowDown: -5_000, ArrowRight: 5_000, ArrowUp: 5_000, PageDown: -30_000, PageUp: 30_000 };

function Slider({ label, value, max, onChange, onCommit }: { label: string; value: number; max: number; onChange: (value: number) => void; onCommit: () => void }) {
  const fill = max > 0 ? `${Math.min(100, (value / max) * 100)}%` : "0%";
  function key(event: ReactKeyboardEvent<HTMLInputElement>) {
    const jump = SLIDER_KEYS[event.key];
    if (jump === undefined) return;
    event.preventDefault();
    onChange(Math.min(max, Math.max(0, value + jump)));
  }
  return <input type="range" className="slider" aria-label={label} aria-valuetext={`${clock(value)} / ${clock(max)}`} min={0} max={max} step={1} value={value} style={{ "--fill": fill } as CSSProperties} onChange={(event) => onChange(Number(event.target.value))} onKeyDown={key} onPointerUp={onCommit} onKeyUp={onCommit} />;
}

function useNow(smooth: boolean): number {
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    if (!smooth) {
      const timer = setInterval(() => setNow(performance.now()), 1000);
      return () => clearInterval(timer);
    }
    let frame = requestAnimationFrame(function tick(time) {
      setNow(time);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [smooth]);
  return now;
}

function Equalizer() {
  return <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>;
}

type Stage = "idle" | "loading" | "paused" | "playing";
const stageOf = (view: Synced | null, track: Track | undefined): Stage => (!track || !view ? "idle" : view.loading ? "loading" : view.paused ? "paused" : "playing");

function Cover({ src }: { src: string | null }) {
  const [layers, setLayers] = useState<{ src: string; ready: boolean; broken: boolean }[]>([]);
  useEffect(() => {
    if (!src) return setLayers([]);
    setLayers((previous) => {
      const known = previous.find((layer) => layer.src === src);
      const settled = previous.filter((layer) => layer.ready && !layer.broken && layer.src !== src).slice(-1);
      return [...settled, known ?? { src, ready: false, broken: false }];
    });
  }, [src]);
  const mark = (target: string, broken: boolean) => setLayers((previous) => previous.map((layer) => (layer.src === target ? { ...layer, ready: true, broken } : layer)));
  const shown = [...layers].reverse().find((layer) => layer.ready && !layer.broken);
  return (
    <div className="cover">
      {shown && <img key={shown.src} className="cover-glow" src={shown.src} alt="" aria-hidden="true" referrerPolicy="no-referrer" />}
      <div className="art art-hero">
        <Icon.Note size={64} />
        {layers.map((layer) => !layer.broken && <img key={layer.src} className={layer.ready ? "ready" : ""} src={layer.src} alt="" referrerPolicy="no-referrer" onLoad={() => mark(layer.src, false)} onError={() => mark(layer.src, true)} />)}
      </div>
    </div>
  );
}

function PlayIcon({ paused }: { paused: boolean }) {
  return <span className="play-icon" data-paused={paused}><Icon.Play /><Icon.Pause /></span>;
}

function NowPlaying({ view, track, command }: { view: Synced | null; track: Track | undefined; command: (body: Command) => Promise<void> }) {
  const now = useNow(stageOf(view, track) === "playing");
  const [seek, setSeek] = useState<number | null>(null);
  if (!track || !view) {
    return (
      <section className="now" data-stage="idle" aria-label={t.tabs.player}>
        <Cover src={null} />
        <div className="now-text">
          <h1 className="title">{t.nothing}</h1>
          <p className="artist">{t.nothingHint}</p>
        </div>
      </section>
    );
  }
  const duration = track.durationMs;
  const position = seek ?? estimate(view, now);
  const loopIndex = LOOP_ORDER.indexOf(view.loop);
  const loopNames: Record<Loop, string> = { off: t.loopOff, track: t.loopTrack, queue: t.loopQueue };
  const cover = artwork(track, 544);
  return (
    <section className="now" data-stage={stageOf(view, track)} aria-label={t.tabs.player}>
      <Cover src={cover} />
      <div className="now-text">
        <p className="eyebrow"><Equalizer />{view.loading ? t.starting : view.paused ? t.paused : t.nowPlaying}</p>
        <div className="swap" key={track.query}>
          <h1 className="title" title={track.title}>{track.url ? <a href={track.url} target="_blank" rel="noreferrer">{track.title}</a> : track.title}</h1>
          <p className="artist">{track.artist || "\u00a0"}</p>
        </div>
      </div>
      <div className={`progress ${view.loading ? "loading" : ""}`}>
        {duration > 0 ? (
          <Slider label={t.position} value={position} max={duration} onChange={setSeek} onCommit={() => { if (seek !== null) { void command({ action: "seek", positionMs: seek }); setSeek(null); } }} />
        ) : <div className="track-line" />}
        <div className="time"><span>{view.loading ? t.starting : clock(position)}</span><span>{duration > 0 ? clock(duration) : "–:––"}</span></div>
      </div>
      <div className="transport">
        <span className="transport-side start">
          <button className="icon-btn" aria-label={t.shuffle} title={t.shuffle} onClick={() => void command({ action: "shuffle" })}><Icon.Shuffle /></button>
          <button className="icon-btn" aria-label={t.previous} aria-keyshortcuts="P" title={`${t.previous} (P)`} onClick={() => void command({ action: "previous" })}><Icon.Previous /></button>
        </span>
        <button className={`play ${view.loading ? "busy" : ""}`} aria-label={view.loading ? t.starting : view.paused ? t.resume : t.pause} aria-busy={view.loading} aria-keyshortcuts="Space K" title={`${view.paused ? t.resume : t.pause} (K)`} onClick={() => void command({ action: view.paused ? "resume" : "pause" })}><PlayIcon paused={view.paused} /></button>
        <span className="transport-side">
          <button className="icon-btn" aria-label={t.skip} aria-keyshortcuts="N" title={`${t.skip} (N)`} onClick={() => void command({ action: "skip" })}><Icon.Skip /></button>
          <button className={`icon-btn ${view.loop !== "off" ? "on" : ""}`} aria-label={`${t.loop}: ${loopNames[view.loop]}`} title={`${t.loop}: ${loopNames[view.loop]}`} onClick={() => void command({ action: "loop", loop: LOOP_ORDER[(loopIndex + 1) % LOOP_ORDER.length] })}>
            <Icon.Repeat />
            {view.loop === "track" && <span className="badge">1</span>}
          </button>
        </span>
      </div>
      <div className="now-foot">
        <label className="switch">
          <input type="checkbox" role="switch" checked={view.autoplay} onChange={(event) => void command({ action: "autoplay", on: event.target.checked })} />
          <span className="knob" aria-hidden="true" />
          {t.autoplay}
        </label>
        <button className="pill danger" onClick={() => void command({ action: "stop" })}>{t.stop}</button>
      </div>
      <p className="listeners"><span className="live-dot" aria-hidden="true" /><Icon.Headphones />{t.listeners(view.listeners)}</p>
    </section>
  );
}

function Dock({ view, track, command, shown }: { view: Synced; track: Track; command: (body: Command) => Promise<void>; shown: boolean }) {
  const now = useNow(shown && stageOf(view, track) === "playing");
  const fill = track.durationMs > 0 ? Math.min(100, (estimate(view, now) / track.durationMs) * 100) : 0;
  return (
    <div className="dock" data-shown={shown} data-stage={stageOf(view, track)} inert={!shown} role="region" aria-label={t.nowPlaying}>
      <span className="dock-line" style={{ "--fill": `${fill}%` } as CSSProperties} />
      <Art src={artwork(track, 96)} className="art-sm" />
      <div className="meta">
        <div className="name">{track.title}</div>
        <div className="sub">{view.loading ? t.starting : track.artist}</div>
      </div>
      <button className={`play small ${view.loading ? "busy" : ""}`} aria-label={view.loading ? t.starting : view.paused ? t.resume : t.pause} onClick={() => void command({ action: view.paused ? "resume" : "pause" })}><PlayIcon paused={view.paused} /></button>
      <button className="icon-btn" aria-label={t.skip} onClick={() => void command({ action: "skip" })}><Icon.Skip /></button>
    </div>
  );
}

function useOffscreen(target: () => Element | null | undefined, watch: unknown): boolean {
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    const element = target();
    if (!element) return setOffscreen(false);
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry!.isIntersecting && entry!.boundingClientRect.top < 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, [watch]);
  return offscreen;
}

type Drag = { id: string; from: number; over: number; dy: number; active: boolean; startY: number; pointerY: number; startScroll: number; step: number; scroller: Element };

const DRAG_THRESHOLD_PX = 5;
const EDGE_PX = 64;

function scrollParent(element: Element): Element {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return document.scrollingElement ?? document.documentElement;
}

function QueueList({ upcoming, offset, command }: { upcoming: Track[]; offset: number; command: (body: Command) => Promise<void> }) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [settling, setSettling] = useState(false);
  const current = useRef<Drag | null>(null);
  const update = (next: Drag | null) => {
    current.current = next;
    setDrag(next);
  };
  const place = (state: Drag, pointerY: number): Drag => {
    const dy = pointerY - state.startY + (state.scroller.scrollTop - state.startScroll);
    const active = state.active || Math.abs(dy) > DRAG_THRESHOLD_PX;
    return { ...state, pointerY, dy, active, over: Math.min(upcoming.length - 1, Math.max(0, state.from + Math.round(dy / state.step))) };
  };
  useEffect(() => {
    if (!drag?.active) return;
    let frame = requestAnimationFrame(function tick() {
      const state = current.current;
      if (!state) return;
      const box = state.scroller === document.scrollingElement ? { top: 0, bottom: innerHeight } : state.scroller.getBoundingClientRect();
      const speed = state.pointerY < box.top + EDGE_PX ? -(box.top + EDGE_PX - state.pointerY) / 4 : state.pointerY > box.bottom - EDGE_PX ? (state.pointerY - box.bottom + EDGE_PX) / 4 : 0;
      if (speed) {
        state.scroller.scrollTop += speed;
        update(place(state, state.pointerY));
      }
      frame = requestAnimationFrame(tick);
    });
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") update(null);
    };
    window.addEventListener("keydown", cancel);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", cancel);
    };
  }, [drag?.active]);
  function down(event: ReactPointerEvent<HTMLLIElement>, index: number, id: string) {
    const target = event.target as Element;
    if (event.button !== 0 || target.closest("button, a")) return;
    const handle = Boolean(target.closest(".grip"));
    if (event.pointerType !== "mouse" && !handle) return;
    const row = event.currentTarget;
    const scroller = scrollParent(row);
    row.setPointerCapture(event.pointerId);
    if (handle) event.preventDefault();
    update({ id, from: index, over: index, dy: 0, active: handle && event.pointerType !== "mouse", startY: event.clientY, pointerY: event.clientY, startScroll: scroller.scrollTop, step: row.offsetHeight + 2, scroller });
  }
  function move(event: ReactPointerEvent<HTMLLIElement>) {
    const state = current.current;
    if (state) update(place(state, event.clientY));
  }
  function up() {
    const state = current.current;
    if (!state) return;
    if (state.active && state.over !== state.from) {
      setSettling(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setSettling(false)));
      void command({ action: "move", id: state.id, to: offset + state.over });
    }
    update(null);
  }
  const shift = (index: number): number => {
    if (!drag?.active) return 0;
    if (index === drag.from) return drag.dy;
    if (drag.from < drag.over && index > drag.from && index <= drag.over) return -drag.step;
    if (drag.over < drag.from && index >= drag.over && index < drag.from) return drag.step;
    return 0;
  };
  return (
    <ol className={`rows queue-list ${drag?.active ? "sorting" : ""} ${settling ? "settling" : ""}`}>
      {upcoming.map((item, index) => {
        const lifted = drag?.active && drag.from === index;
        return (
          <li key={item.id} className={`song queue-row ${lifted ? "lifted" : ""}`} style={shift(index) ? { transform: `translateY(${shift(index)}px)${lifted ? " scale(1.02)" : ""}` } : undefined} onPointerDown={(event) => down(event, index, item.id)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => update(null)} onLostPointerCapture={() => { if (current.current) up(); }}>
            <span className="grip" aria-hidden="true"><span className="pos">{index + 1 + Math.sign(shift(index))}</span><Icon.Grip /></span>
            <Art src={artwork(item, 96)} className="art-sm" />
            <div className="meta">
              <div className="name">{item.title}</div>
              {item.artist && <div className="sub">{item.artist}</div>}
            </div>
            {item.durationMs > 0 && <span className="len">{clock(item.durationMs)}</span>}
            <span className="reorder">
              <button className="icon-btn small" aria-label={`${t.up}: ${item.title}`} disabled={index === 0} onClick={() => void command({ action: "move", id: item.id, to: offset + index - 1 })}><Icon.Up /></button>
              <button className="icon-btn small" aria-label={`${t.down}: ${item.title}`} disabled={index === upcoming.length - 1} onClick={() => void command({ action: "move", id: item.id, to: offset + index + 1 })}><Icon.Down /></button>
            </span>
            <button className="icon-btn small" aria-label={`${t.remove}: ${item.title}`} onClick={() => void command({ action: "remove", id: item.id })}><Icon.Close /></button>
          </li>
        );
      })}
    </ol>
  );
}

function PlayerTab({ view, setView, refresh, live }: { view: Synced | null; setView: (view: Synced) => void; refresh: () => void; live: boolean }) {
  const [error, setError] = useState<string | null>(null);
  async function command(body: Command) {
    setError(null);
    if (view) setView(predict(view, body));
    try {
      setView(stamp(await post<View>("command", { command: body })));
    } catch (failure) {
      setError(message(failure));
      refresh();
    }
  }
  const latest = useRef({ view, command });
  latest.current = { view, command };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      const { view: current, command: send } = latest.current;
      const playing = current?.active && current.current >= 0 && current.current < current.tracks.length;
      const key = event.key.toLowerCase();
      if (key === "/") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("input[data-search]")?.focus();
      } else if (playing && (key === "k" || (key === " " && !target.closest("button, a")))) {
        event.preventDefault();
        void send({ action: current.paused ? "resume" : "pause" });
      } else if (playing && key === "n") {
        event.preventDefault();
        void send({ action: "skip" });
      } else if (current?.active && key === "p") {
        event.preventDefault();
        void send({ action: "previous" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [searching, setSearching] = useState(false);
  const seedKey = view?.active ? (view.tracks[view.current]?.query ?? "end") : "";
  async function add(item: QueueItem) {
    if (view) setView(predictAdd(view, item));
    try {
      await enqueue({ items: [item] });
    } catch (failure) {
      refresh();
      throw failure;
    }
  }
  const [skipped, setSkipped] = useState<string | null>(null);
  const lastSkipped = useRef(view?.skipped?.id ?? null);
  const skippedNow = view?.skipped ?? null;
  useEffect(() => {
    if (!skippedNow || skippedNow.id === lastSkipped.current) return;
    lastSkipped.current = skippedNow.id;
    setSkipped(skippedNow.title);
  }, [skippedNow?.id]);
  useEffect(() => {
    if (!skipped) return;
    const timer = setTimeout(() => setSkipped(null), 8000);
    return () => clearTimeout(timer);
  }, [skipped]);
  const track = view && view.active ? view.tracks[view.current] : undefined;
  const upcoming = view?.active ? view.tracks.slice(view.current + 1) : [];
  const offset = (view?.current ?? 0) + 1;
  const auto = view?.active ? (view.autoplayNext ?? null) : null;
  const nowRef = useRef<HTMLDivElement>(null);
  const docked = useOffscreen(() => nowRef.current?.querySelector(".transport"), track?.id ?? null);
  return (
    <>
      {!live && <p className="notice" role="status">{t.offline}</p>}
      <div className="player">
        <div className="now-col" ref={nowRef}>
          <div className="now-stage">
            <NowPlaying view={view} track={track} command={command} />
            <div className="now-extras">
              {track && view?.autoplay && view.autoplayEndsAt && (
                <div className="autoplay-note">
                  <span className="sub">{t.autoplayEnds(Math.max(0, Math.ceil((view.autoplayEndsAt - Date.now()) / 60000)))}</span>
                  <button className="pill" onClick={() => void command({ action: "keepGoing" })}>{t.keepGoing}</button>
                </div>
              )}
              {error && <p className="error" role="alert">{error}</p>}
              {skipped && <p className="notice" role="status">{t.skippedFailed(skipped)}</p>}
            </div>
          </div>
        </div>
        <div className="side">
          <div className="discover-col">
            <SongSearch warmUp placeholder={t.searchPlaceholder} onPick={add} onLink={(input) => enqueue({ input })} onActive={setSearching} />
            {seedKey && <Suggestions seedKey={seedKey} onPick={add} hidden={searching} />}
          </div>
          <div className="queue-col">
            {track && (
              <section className="queue-area" aria-label={t.queue}>
                <div className="label-row">
                  <h2 className="label">{t.queue}{upcoming.length > 0 && <span className="count">{upcoming.length}</span>}</h2>
                  {upcoming.length > 0 && <button className="pill ghost" onClick={() => void command({ action: "clear" })}>{t.clear}</button>}
                </div>
                {upcoming.length === 0 && !auto && <p className="hint">{view?.autoplay ? t.autoplayPicking : t.queueEmpty}</p>}
                {upcoming.length > 0 && <QueueList upcoming={upcoming} offset={offset} command={command} />}
                {auto && (
                  <div className="song auto-row">
                    <span className="grip" />
                    <Art src={artwork(auto, 96)} className="art-sm" />
                    <div className="meta">
                      <div className="name">{auto.title}</div>
                      {auto.artist && <div className="sub">{auto.artist}</div>}
                    </div>
                    <span className="tag">{t.autoplay}</span>
                  </div>
                )}
              </section>
            )}
            {seedKey && <RecentlyPlayed seedKey={seedKey} current={track?.url ?? null} onPick={add} />}
          </div>
        </div>
      </div>
      {track && view && <Dock view={view} track={track} command={command} shown={docked} />}
    </>
  );
}

function hueOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

function Tile({ seed, className }: { seed: string; className?: string }) {
  return <div className={`tile ${className ?? ""}`} style={{ "--h": hueOf(seed) } as CSSProperties}><Icon.Note size={28} /></div>;
}

function PlaylistsTab({ me }: { me: Me }) {
  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const reload = useCallback(() => get<Playlist[]>("playlists").then(setLists, () => setLists([])), []);
  const reloadTracks = useCallback((id: string) => get<PlaylistTrack[]>(`playlist/tracks?id=${id}`).then(setTracks), []);
  useEffect(() => void reload(), [reload]);
  useEffect(() => {
    if (open) void reloadTracks(open);
  }, [open, reloadTracks]);
  const list = lists?.find((entry) => entry.id === open);
  const owned = list?.ownerId === me.discordId;
  const act = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await reload();
      if (open) await reloadTracks(open);
    } catch (failure) {
      setError(message(failure));
    }
  };
  const play = async (items: PlaylistTrack[]) => {
    setError(null);
    try {
      await enqueue({ items: items.map(({ query, title }) => ({ query, title })) });
    } catch (failure) {
      setError(message(failure));
      throw failure;
    }
  };
  if (list) {
    return (
      <section className="sheet" aria-label={list.name}>
        <button className="pill ghost back" onClick={() => setOpen(null)}><Icon.Back />{t.back}</button>
        <div className="list-hero">
          <Tile seed={list.id} className="tile-hero" />
          <div className="list-hero-text">
            <h2 className="title">{list.name}</h2>
            <p className="sub">{t.by(list.ownerName)} · {t.tracks(tracks.length)}</p>
            <div className="row">
              <QueueButton className="btn primary" label={t.play} disabled={!tracks.length} run={() => play(tracks)} />
              {owned && <button className="btn" onClick={() => { const next = prompt(t.rename, list.name); if (next?.trim()) void act(() => post("playlist/rename", { id: list.id, name: next })); }}>{t.rename}</button>}
              {owned && <button className="btn danger" onClick={() => { if (confirm(t.confirmDelete(list.name))) void act(async () => { await post("playlist/delete", { id: list.id }); setOpen(null); }); }}>{t.delete}</button>}
            </div>
          </div>
        </div>
        <div className="panel">
          {owned && <SongSearch placeholder={t.addToList} onPick={async (item) => { await post("playlist/add", { id: list.id, items: [item] }); await reload(); await reloadTracks(list.id); }} onLink={async (input) => { await post("playlist/add", { id: list.id, input }); await reload(); await reloadTracks(list.id); }} />}
          {error && <p className="error" role="alert">{error}</p>}
          {tracks.length === 0 ? <p className="hint">{t.emptyList}</p> : (
            <ol className="rows">
              {tracks.map((track, index) => (
                <li key={track.id} className="song">
                  <span className="num">{index + 1}</span>
                  <Art src={artwork(track, 96)} className="art-sm" />
                  <div className="meta"><div className="name">{track.title}</div></div>
                  {owned && <button className="icon-btn small" aria-label={`${t.up}: ${track.title}`} disabled={index === 0} onClick={() => void act(() => post("playlist/move", { id: list.id, trackId: track.id, to: index - 1 }))}><Icon.Up /></button>}
                  {owned && <button className="icon-btn small" aria-label={`${t.down}: ${track.title}`} disabled={index === tracks.length - 1} onClick={() => void act(() => post("playlist/move", { id: list.id, trackId: track.id, to: index + 1 }))}><Icon.Down /></button>}
                  {owned && <button className="icon-btn small" aria-label={`${t.remove}: ${track.title}`} onClick={() => void act(() => post("playlist/remove", { id: list.id, trackId: track.id }))}><Icon.Close /></button>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    );
  }
  return (
    <section className="sheet" aria-label={t.tabs.playlists}>
      <form className="create" onSubmit={(event) => { event.preventDefault(); if (name.trim()) void act(async () => { const { id } = await post<{ id: string }>("playlists", { name }); setName(""); setOpen(id); }); }}>
        <span className="create-icon" aria-hidden="true"><Icon.Plus /></span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t.newPlaylist} aria-label={t.newPlaylist} />
        <button className="pill primary" disabled={!name.trim()}>{t.create}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {lists?.length === 0 && <p className="hint">{t.noPlaylists}</p>}
      <ul className="tiles">
        {lists?.map((entry) => (
          <li key={entry.id}>
            <button className="tile-card" onClick={() => setOpen(entry.id)}>
              <Tile seed={entry.id} />
              <span className="name">{entry.name}</span>
              <span className="sub">{t.by(entry.ownerName)} · {t.tracks(entry.trackCount)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QueueButton({ className, label, disabled, run }: { className: string; label: string; disabled?: boolean; run: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  useEffect(() => {
    if (state !== "done") return;
    const timer = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [state]);
  function click() {
    setState("busy");
    run().then(() => setState("done"), () => setState("idle"));
  }
  return <button className={`${className} ${state === "done" ? "done" : ""}`} disabled={disabled || state === "busy"} aria-live="polite" onClick={click}>{state === "busy" ? t.adding : state === "done" ? t.queued : label}</button>;
}

function dayLabel(time: number): string {
  const day = new Date(time).toDateString();
  if (day === new Date().toDateString()) return t.today;
  if (day === new Date(Date.now() - 86_400_000).toDateString()) return t.yesterday;
  return new Date(time).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" });
}

function HistoryTab() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => void get<HistoryEntry[]>("history").then(setEntries, () => setEntries([])), []);
  const days: { label: string; entries: HistoryEntry[] }[] = [];
  for (const entry of entries ?? []) {
    const label = dayLabel(entry.playedAt);
    if (days.at(-1)?.label === label) days.at(-1)!.entries.push(entry);
    else days.push({ label, entries: [entry] });
  }
  return (
    <section className="sheet" aria-label={t.tabs.history}>
      {error && <p className="error" role="alert">{error}</p>}
      {entries?.length === 0 && <p className="hint">{t.noHistory}</p>}
      {days.map((day) => (
        <section key={day.label} className="day" aria-label={day.label}>
          <h2 className="label">{day.label}</h2>
          <ul className="rows history-rows">
            {day.entries.map((entry) => (
              <li key={entry.id} className="song">
                <Art src={artwork(entry, 96)} className="art-md" />
                <div className="meta">
                  <div className="name">{entry.url ? <a href={entry.url} target="_blank" rel="noreferrer">{entry.title}</a> : entry.title}</div>
                  <div className="sub">{[entry.artist, new Date(entry.playedAt).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })].filter(Boolean).join(" · ")}</div>
                </div>
                <QueueButton className="pill" label={t.requeue} run={async () => {
                  setError(null);
                  try {
                    await enqueue({ items: [{ query: entry.url ?? entry.query, title: entry.title, artist: entry.artist, artwork: entry.artwork, durationMs: entry.durationMs }] });
                  } catch (failure) {
                    setError(message(failure));
                    throw failure;
                  }
                }} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

function SettingsTab() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => void get<SettingsData>("settings").then(setData, (failure: unknown) => setError(message(failure))), []);
  if (!data) return error ? <p className="error" role="alert">{error}</p> : null;
  return (
    <form className="panel narrow" aria-label={t.tabs.settings} onSubmit={(event) => { event.preventDefault(); setSaved(false); setError(null); post<SettingsData>("settings", { djRoleId: data.djRoleId }).then((next) => { setData(next); setSaved(true); }, (failure: unknown) => setError(message(failure))); }}>
      <label className="stack">{t.djRole}
        <select className="field" value={data.djRoleId ?? ""} onChange={(event) => setData({ ...data, djRoleId: event.target.value || null })}>
          <option value="">{t.noRole}</option>
          {data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </label>
      <p className="hint">{t.djRoleHelp}</p>
      <div className="row">
        <button className="btn primary">{t.save}</button>
        {saved && <span className="hint" role="status">{t.saved}</span>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </form>
  );
}

function Brand() {
  return <div className="brand"><span className="mark"><Icon.Note size={18} /></span><span>DJ</span></div>;
}

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("player");
  const { view, live, setView, refresh } = useView(me);
  const playingNow = view?.active ? view.tracks[view.current] : undefined;
  const tabTitle = playingNow ? `${view?.loading ? "…" : view?.paused ? "❚❚" : "▶"} ${[playingNow.title, playingNow.artist].filter(Boolean).join(" · ")} · DJ` : BASE_TITLE;
  const backdrop = playingNow ? artwork(playingNow, 226) : null;
  useAccent(backdrop);
  useEffect(() => {
    document.title = tabTitle;
  }, [tabTitle]);
  useEffect(() => {
    document.documentElement.lang = lang;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const load = () => {
      get<Me>("me").then((next) => {
        if (stopped) return;
        setOwnerName(next.user.name);
        setFailed(false);
        setMe(next);
      }, (error: unknown) => {
        if (stopped || (error as Error).message === "signedOut") return;
        setFailed(true);
        timer = setTimeout(load, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)]);
      });
    };
    load();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
  if (!me) {
    return (
      <>
        <Ambient src={null} paused />
        <div className="page" aria-busy="true">
          <header className="top"><Brand /></header>
          {failed && <p className="notice" role="status">{t.reconnecting}</p>}
          <main className="main">
            <div className="player">
              <div className="now-col">
                <div className="now-stage">
                  <section className="now" data-stage="idle">
                    <div className="cover"><div className="art art-hero skeleton" /></div>
                    <div className="now-text">
                      <div className="skeleton line wide" />
                      <div className="skeleton line" />
                    </div>
                  </section>
                </div>
              </div>
              <div className="side">
                <div className="discover-col"><div className="skeleton search-line" /></div>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }
  const tabs: Tab[] = me.canPlay ? ["player", "playlists", "history", ...(me.canManage ? (["settings"] as const) : [])] : me.canManage ? ["settings"] : [];
  const active = tabs.includes(tab) ? tab : tabs[0];
  return (
    <>
      <Ambient src={backdrop} paused={!playingNow || Boolean(view?.paused)} />
      <div className="page" data-tab={active}>
        <header className="top">
          <Brand />
          {tabs.length > 0 && (
            <nav className="tabs" role="tablist">
              {tabs.map((entry) => <button key={entry} role="tab" aria-selected={active === entry} onClick={() => setTab(entry)}>{t.tabs[entry]}</button>)}
            </nav>
          )}
          <div className="who">
            <div className="lang-switch" role="group" aria-label={t.language}>
              {LANGS.map((entry) => <button key={entry.code} lang={entry.code} aria-label={entry.name} title={entry.name} aria-pressed={lang === entry.code} onClick={() => { if (lang !== entry.code) switchLang(); }}>{entry.code.toUpperCase()}</button>)}
            </div>
            {me.user.image ? <img className="avatar" src={me.user.image} alt={me.user.name} title={me.user.name} referrerPolicy="no-referrer" /> : <span className="avatar" title={me.user.name}>{me.user.name.slice(0, 1).toUpperCase()}</span>}
          </div>
        </header>
        {!me.member && <p className="notice">{t.notMember}</p>}
        {me.member && !me.canPlay && <p className="notice">{t.denied}</p>}
        <main className="main">
          {active === "player" && <PlayerTab view={view} setView={setView} refresh={refresh} live={live} />}
          {active === "playlists" && <PlaylistsTab me={me} />}
          {active === "history" && <HistoryTab />}
          {active === "settings" && <SettingsTab />}
        </main>
      </div>
    </>
  );
}
