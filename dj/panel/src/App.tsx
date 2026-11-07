import { type CSSProperties, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, get, handleReply, type HistoryEntry, type Ticket, type Loop, type Me, type Playlist, type PlaylistTrack, post, setOwnerName, type SettingsData, signIn, type Song, type Track, attachSocket, type View } from "./api";
import { lang, switchLang, t } from "./i18n";
import * as Icon from "./icons";

type Tab = "player" | "playlists" | "history" | "settings";
type QueueItem = { query: string; title?: string; artist?: string | null; artwork?: string | null; durationMs?: number };
type Synced = View & { at: number };
type Command = { action: string; positionMs?: number; loop?: Loop; on?: boolean; id?: string; to?: number };

const message = (error: unknown) => t.errors[error instanceof ApiError ? error.message : "failed"] ?? t.errors.failed!;
const isLink = (text: string) => /^https?:\/\//.test(text.trim());
const LOOP_ORDER: Loop[] = ["off", "queue", "track"];
const BASE_TITLE = document.title;
const RETRY_MS = [1_000, 3_000, 10_000, 30_000];

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

function Suggestions({ seedKey, onPick, hidden }: { seedKey: string; onPick: (item: QueueItem) => Promise<void>; hidden: boolean }) {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const warm = useWarm(true);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      get<Song[]>("suggestions").then((next) => {
        if (current) setSongs(next);
      }, () => undefined);
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [seedKey]);
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
    <section className="suggest-area" aria-label={t.suggested} hidden={hidden}>
      <h2 className="label">{t.suggested}</h2>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="rows">
        {songs.map((song) => <SongRow key={song.videoId} song={song} done={added.has(song.videoId)} disabled={added.has(song.videoId)} onAdd={() => void pick(song)} warm={warm} />)}
      </ul>
    </section>
  );
}

const RECENT_SHOWN = 20;

function RecentlyPlayed({ seedKey, current, onPick }: { seedKey: string; current: string | null; onPick: (item: QueueItem) => Promise<void> }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const warm = useWarm(true);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      get<HistoryEntry[]>("history").then((next) => {
        if (live) setEntries(next);
      }, () => undefined);
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [seedKey]);
  const seen = new Set<string>(current ? [current] : []);
  const songs: Song[] = [];
  for (const entry of entries) {
    const url = entry.url ?? entry.query;
    const id = url.match(/[?&]v=([\w-]{11})/)?.[1];
    if (!id || seen.has(url)) continue;
    seen.add(url);
    songs.push({ videoId: id, url, title: entry.title, artist: "", album: null, durationMs: 0, artwork: null, plays: null });
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
    <section className="recent-area" aria-label={t.playedBefore}>
      <h2 className="label">{t.playedBefore}</h2>
      <ul className="rows">
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
      {results === null && !loading && !error && <p className="hint">{t.searchHint}</p>}
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

function Slider({ label, value, max, step, onChange, onCommit, className }: { label: string; value: number; max: number; step: number; onChange: (value: number) => void; onCommit: () => void; className?: string }) {
  const fill = max > 0 ? `${Math.min(100, (value / max) * 100)}%` : "0%";
  return <input type="range" className={`slider ${className ?? ""}`} aria-label={label} min={0} max={max} step={step} value={value} style={{ "--fill": fill } as CSSProperties} onChange={(event) => onChange(Number(event.target.value))} onPointerUp={onCommit} onKeyUp={onCommit} />;
}

function NowPlaying({ view, track, command }: { view: Synced | null; track: Track | undefined; command: (body: Command) => Promise<void> }) {
  const [now, setNow] = useState(performance.now());
  const [seek, setSeek] = useState<number | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(timer);
  }, []);
  if (!track || !view) {
    return (
      <section className="now" aria-label={t.tabs.player}>
        <Art src={null} className="art-hero" />
        <div>
          <h1 className="title">{t.nothing}</h1>
          <p className="sub">{t.nothingHint}</p>
        </div>
      </section>
    );
  }
  const duration = track.durationMs;
  const position = seek ?? estimate(view, now);
  const loopIndex = LOOP_ORDER.indexOf(view.loop);
  const loopNames: Record<Loop, string> = { off: t.loopOff, track: t.loopTrack, queue: t.loopQueue };
  return (
    <section className="now" aria-label={t.tabs.player}>
      <Art src={artwork(track, 544)} className="art-hero" />
      <div>
        <h1 className="title">{track.url ? <a href={track.url} target="_blank" rel="noreferrer">{track.title}</a> : track.title}</h1>
        {track.artist && <p className="sub">{track.artist}</p>}
      </div>
      <div className={`progress ${view.loading ? "loading" : ""}`}>
        {duration > 0 ? (
          <Slider label={t.position} value={position} max={duration} step={1000} onChange={setSeek} onCommit={() => { if (seek !== null) { void command({ action: "seek", positionMs: seek }); setSeek(null); } }} className="bright" />
        ) : <div className="track-line" />}
        <div className="time"><span>{view.loading ? t.starting : clock(position)}</span><span>{duration > 0 ? clock(duration) : "–:––"}</span></div>
      </div>
      <div className="transport">
        <span className="transport-side start">
          <button className="icon-btn" aria-label={t.shuffle} onClick={() => void command({ action: "shuffle" })}><Icon.Shuffle /></button>
        </span>
        <button className={`play ${view.loading ? "busy" : ""}`} aria-label={view.loading ? t.starting : view.paused ? t.resume : t.pause} aria-busy={view.loading} aria-keyshortcuts="Space K" title={`${view.paused ? t.resume : t.pause} (K)`} onClick={() => void command({ action: view.paused ? "resume" : "pause" })}>{view.paused ? <Icon.Play /> : <Icon.Pause />}</button>
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
      {view.autoplay && view.autoplayEndsAt && (
        <div className="autoplay-note">
          <span className="sub">{t.autoplayEnds(Math.max(0, Math.ceil((view.autoplayEndsAt - Date.now()) / 60000)))}</span>
          <button className="pill" onClick={() => void command({ action: "keepGoing" })}>{t.keepGoing}</button>
        </div>
      )}
    </section>
  );
}

function PlayerTab({ view, setView, refresh, live }: { view: Synced | null; setView: (view: Synced) => void; refresh: () => void; live: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [searching, setSearching] = useState(false);
  const seedKey = view?.active ? view.tracks.map((entry) => entry.id).join(",") : "";
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
  return (
    <>
      {!live && <p className="notice" role="status">{t.offline}</p>}
      <div className="player">
        <div className="now-col">
          <NowPlaying view={view} track={track} command={command} />
          {error && <p className="error" role="alert">{error}</p>}
          {skipped && <p className="notice" role="status">{t.skippedFailed(skipped)}</p>}
          {track && view && <p className="fine">{t.listeners(view.listeners)}</p>}
          {seedKey && <RecentlyPlayed seedKey={seedKey} current={track?.url ?? null} onPick={add} />}
        </div>
        <div className="side">
          <SongSearch warmUp placeholder={t.searchPlaceholder} onPick={add} onLink={(input) => enqueue({ input })} onActive={setSearching} />
          {track && (
            <section className="queue-area" aria-label={t.queue}>
              <div className="label-row">
                <h2 className="label">{upcoming.length ? `${t.queue} · ${upcoming.length}` : t.queue}</h2>
                {upcoming.length > 0 && <button className="pill ghost" onClick={() => void command({ action: "clear" })}>{t.clear}</button>}
              </div>
              {upcoming.length === 0 && !auto && <p className="hint">{view?.autoplay ? t.autoplayPicking : t.queueEmpty}</p>}
              {upcoming.length > 0 && (
                <ol className="rows">
                  {upcoming.map((item, index) => (
                    <li key={item.id} className={`song queue-row ${dragging === item.id ? "dragging" : ""}`} draggable onDragStart={() => setDragging(item.id)} onDragEnd={() => setDragging(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragging && dragging !== item.id) void command({ action: "move", id: dragging, to: offset + index }); setDragging(null); }}>
                      <span className="grip"><Icon.Grip /></span>
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
                  ))}
                </ol>
              )}
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
          {seedKey && <Suggestions seedKey={seedKey} onPick={add} hidden={searching} />}
        </div>
      </div>
    </>
  );
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
      <section className="card" aria-label={list.name}>
        <div><button className="linkish" style={{ paddingLeft: 0 }} onClick={() => setOpen(null)}>← {t.back}</button></div>
        <div>
          <h2 className="title">{list.name}</h2>
          <p className="dim">{t.by(list.ownerName)} · {t.tracks(tracks.length)}</p>
        </div>
        <div className="row">
          <QueueButton className="btn primary" label={t.play} disabled={!tracks.length} run={() => play(tracks)} />
          {owned && <button className="btn" onClick={() => { const next = prompt(t.rename, list.name); if (next?.trim()) void act(() => post("playlist/rename", { id: list.id, name: next })); }}>{t.rename}</button>}
          {owned && <button className="btn danger" onClick={() => { if (confirm(t.confirmDelete(list.name))) void act(async () => { await post("playlist/delete", { id: list.id }); setOpen(null); }); }}>{t.delete}</button>}
        </div>
        {owned && <SongSearch placeholder={t.addToList} onPick={async (item) => { await post("playlist/add", { id: list.id, items: [item] }); await reload(); await reloadTracks(list.id); }} onLink={async (input) => { await post("playlist/add", { id: list.id, input }); await reload(); await reloadTracks(list.id); }} />}
        {error && <p className="error" role="alert">{error}</p>}
        {tracks.length === 0 ? <p className="dim">{t.emptyList}</p> : (
          <ol className="list">
            {tracks.map((track, index) => (
              <li key={track.id} className="item">
                <span className="num">{index + 1}</span>
                <span className="name">{track.title}</span>
                {owned && <button className="btn small" aria-label={`${t.up}: ${track.title}`} disabled={index === 0} onClick={() => void act(() => post("playlist/move", { id: list.id, trackId: track.id, to: index - 1 }))}>↑</button>}
                {owned && <button className="btn small" aria-label={`${t.down}: ${track.title}`} disabled={index === tracks.length - 1} onClick={() => void act(() => post("playlist/move", { id: list.id, trackId: track.id, to: index + 1 }))}>↓</button>}
                {owned && <button className="btn small" aria-label={`${t.remove}: ${track.title}`} onClick={() => void act(() => post("playlist/remove", { id: list.id, trackId: track.id }))}>✕</button>}
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }
  return (
    <section className="card" aria-label={t.tabs.playlists}>
      <form className="row" onSubmit={(event) => { event.preventDefault(); if (name.trim()) void act(async () => { const { id } = await post<{ id: string }>("playlists", { name }); setName(""); setOpen(id); }); }}>
        <input className="field grow" value={name} onChange={(event) => setName(event.target.value)} placeholder={t.newPlaylist} aria-label={t.newPlaylist} />
        <button className="btn primary">{t.create}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {lists?.length === 0 && <p className="dim">{t.noPlaylists}</p>}
      <ul className="list">
        {lists?.map((entry) => (
          <li key={entry.id} className="item">
            <button className="linkish name" style={{ textAlign: "left", color: "var(--text)", paddingLeft: 0 }} onClick={() => setOpen(entry.id)}>{entry.name}</button>
            <span className="dim">{t.by(entry.ownerName)} · {t.tracks(entry.trackCount)}</span>
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

function HistoryTab() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => void get<HistoryEntry[]>("history").then(setEntries, () => setEntries([])), []);
  return (
    <section className="card" aria-label={t.tabs.history}>
      {error && <p className="error" role="alert">{error}</p>}
      {entries?.length === 0 && <p className="dim">{t.noHistory}</p>}
      <ul className="list">
        {entries?.map((entry) => (
          <li key={entry.id} className="item">
            <span className="name">{entry.url ? <a href={entry.url} target="_blank" rel="noreferrer">{entry.title}</a> : entry.title}</span>
            <span className="dim">{new Date(entry.playedAt).toLocaleString()}</span>
            <QueueButton className="btn small" label={t.requeue} run={async () => {
              setError(null);
              try {
                await enqueue({ items: [{ query: entry.url ?? entry.query, title: entry.title }] });
              } catch (failure) {
                setError(message(failure));
                throw failure;
              }
            }} />
          </li>
        ))}
      </ul>
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
    <form className="card" aria-label={t.tabs.settings} onSubmit={(event) => { event.preventDefault(); setSaved(false); setError(null); post<SettingsData>("settings", { djRoleId: data.djRoleId }).then((next) => { setData(next); setSaved(true); }, (failure: unknown) => setError(message(failure))); }}>
      <label className="stack">{t.djRole}
        <select className="field" value={data.djRoleId ?? ""} onChange={(event) => setData({ ...data, djRoleId: event.target.value || null })}>
          <option value="">{t.noRole}</option>
          {data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </label>
      <p className="dim">{t.djRoleHelp}</p>
      <div className="row">
        <button className="btn primary">{t.save}</button>
        {saved && <span className="dim" role="status">{t.saved}</span>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </form>
  );
}

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("player");
  const { view, live, setView, refresh } = useView(me);
  const playingNow = view?.active ? view.tracks[view.current] : undefined;
  const tabTitle = playingNow ? `${view?.loading ? "…" : view?.paused ? "❚❚" : "▶"} ${[playingNow.title, playingNow.artist].filter(Boolean).join(" · ")} · DJ` : BASE_TITLE;
  useEffect(() => {
    document.title = tabTitle;
  }, [tabTitle]);
  useEffect(() => {
    document.documentElement.lang = lang;
    get<Me>("me").then((next) => {
      setOwnerName(next.user.name);
      setMe(next);
    }, (error: unknown) => {
      if ((error as Error).message !== "signedOut") setFailed(true);
    });
  }, []);
  if (failed) {
    return (
      <main className="page">
        <p className="error" role="alert">{t.errors.failed}</p>
        <div><button className="btn" onClick={signIn}>{t.retry}</button></div>
      </main>
    );
  }
  if (!me) {
    return (
      <div className="page" aria-busy="true">
        <header className="top">
          <div className="brand"><span className="mark"><Icon.Note size={18} /></span>DJ</div>
        </header>
        <main className="main">
          <div className="player">
            <div className="now-col">
              <div className="art art-hero skeleton" />
              <div className="skeleton line wide" />
              <div className="skeleton line" />
            </div>
            <div className="side">
              <div className="skeleton search-line" />
            </div>
          </div>
        </main>
      </div>
    );
  }
  const tabs: Tab[] = me.canPlay ? ["player", "playlists", "history", ...(me.canManage ? (["settings"] as const) : [])] : me.canManage ? ["settings"] : [];
  const active = tabs.includes(tab) ? tab : tabs[0];
  return (
    <div className="page">
      <header className="top">
        <div className="brand"><span className="mark"><Icon.Note size={18} /></span>DJ</div>
        {tabs.length > 0 && (
          <nav className="tabs" role="tablist">
            {tabs.map((entry) => <button key={entry} role="tab" aria-selected={active === entry} onClick={() => setTab(entry)}>{t.tabs[entry]}</button>)}
          </nav>
        )}
        <div className="who">
          <button className="pill ghost lang" aria-label={t.language} title={t.language} onClick={switchLang}>{lang === "es" ? "EN" : "ES"}</button>
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
  );
}
