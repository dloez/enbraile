import { type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type FocusEvent as ReactFocusEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { type Album, ApiError, type Artist, type ArtistPage, type ArtistRef, type AutoplayMode, cached, get, type Listener, handleReply, type HistoryEntry, load, onCache, prefetch, remember, type Requester, type Ticket, type Loop, type Me, type Playlist, type PlaylistTrack, post, type SessionSummary, type SessionTrack, setOwnerName, type SettingsData, type Song, type Track, attachSocket, type View, type Visibility } from "./api";
import { lang, switchLang, t } from "./i18n";
import * as Icon from "./icons";
import { Ambient, useAccent } from "./ambient";

type Tab = "player" | "playlists" | "history" | "settings";

type Route = { tab: Tab; list: string | null };

const ROUTE_TABS: Tab[] = ["playlists", "history", "settings"];

function readRoute(): Route {
  const [first, second] = location.pathname.split("/").filter(Boolean);
  const tab = ROUTE_TABS.find((entry) => entry === first) ?? "player";
  return { tab, list: tab === "playlists" && second ? decodeURIComponent(second) : null };
}

const routePath = (route: Route) => (route.tab === "player" ? "/" : `/${route.tab}${route.list ? `/${encodeURIComponent(route.list)}` : ""}`);

function useRoute(): [Route, (route: Route, replace?: boolean) => void] {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const back = () => setRoute(readRoute());
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const go = useCallback((next: Route, replace = false) => {
    const path = routePath(next);
    if (path !== location.pathname) history[replace ? "replaceState" : "pushState"](null, "", path);
    setRoute(next);
  }, []);
  return [route, go];
}
type QueueItem = { query: string; title?: string; artist?: string | null; artists?: ArtistRef[]; album?: string | null; albumId?: string | null; artwork?: string | null; durationMs?: number; playlist?: { id: string; name: string } };
type Synced = View & { at: number; stale?: boolean };
type Command = { action: string; positionMs?: number; loop?: Loop; on?: boolean; id?: string; to?: number; mode?: AutoplayMode };
type ArtistTarget = { id?: string; name: string };
type OpenArtist = (target: ArtistTarget) => void;
type AlbumTarget = { id?: string | null; name: string; artist?: string | null; videoId?: string | null };
type Browse = { kind: "artist"; target: ArtistTarget } | { kind: "album"; target: AlbumTarget };

const message = (error: unknown) => t.errors[error instanceof ApiError ? error.message : "failed"] ?? t.errors.failed!;
const isLink = (text: string) => /^https?:\/\//.test(text.trim());
const LOOP_ORDER: Loop[] = ["off", "queue", "track"];
const BASE_TITLE = document.title;
const RETRY_MS = [1_000, 3_000, 10_000, 30_000];
const SILENT_SOCKET_MS = 25_000;
const RESTART_WITHIN_MS = 3_000;
const ROLE_RECHECK_MS = 30_000;
const LANGS = [{ code: "en", name: "English" }, { code: "es", name: "Español" }] as const;

const stamp = (view: View): Synced => ({ ...view, at: performance.now() });

function estimate(view: Synced, now: number): number {
  const duration = view.tracks[view.current]?.durationMs ?? 0;
  const position = view.paused || view.loading || view.stalled || view.stale ? view.positionMs : view.positionMs + (now - view.at);
  return duration > 0 ? Math.min(position, duration) : position;
}

function predictAdd(view: Synced, item: QueueItem): Synced {
  const track: Track = { id: `pending-${crypto.randomUUID()}`, query: item.query, title: item.title ?? item.query, artist: item.artist ?? null, artists: item.artists, album: item.album ?? null, albumId: item.albumId ?? null, artwork: item.artwork ?? null, durationMs: item.durationMs ?? 0, url: null, requestedBy: "" };
  const now = performance.now();
  const tracks = [...view.tracks, track];
  if (view.active && view.current >= 0 && view.current < view.tracks.length) return { ...view, positionMs: estimate(view, now), at: now, tracks };
  return { ...view, at: now, active: true, tracks, current: view.tracks.length, positionMs: 0, paused: false, loading: true };
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
      let autoplayUpcoming = view.autoplayUpcoming;
      if (current >= tracks.length && view.loop === "queue") current = 0;
      else if (current >= tracks.length && autoplayUpcoming[0]) {
        tracks = [...tracks, autoplayUpcoming[0]];
        autoplayUpcoming = autoplayUpcoming.slice(1);
      }
      return { ...next, tracks, current, positionMs: 0, paused: false, loading: current < tracks.length, autoplayUpcoming };
    }
    case "previous": {
      const current = next.positionMs <= RESTART_WITHIN_MS && view.current > 0 ? Math.min(view.current, view.tracks.length) - 1 : view.current;
      return { ...next, current, positionMs: 0, paused: false, loading: true };
    }
    case "loop":
      return { ...next, loop: command.loop ?? "off" };
    case "autoplay":
      return { ...next, autoplay: Boolean(command.on), autoplayUpcoming: [] };
    case "swapPick":
      return { ...next, autoplayUpcoming: view.autoplayUpcoming.map((pick) => (pick.id === command.id ? { ...pick, replacing: true } : pick)) };
    case "autoplayMode":
      return { ...next, autoplayMode: command.mode ?? view.autoplayMode };
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

function Who({ requester }: { requester: Requester | null | undefined }) {
  const [broken, setBroken] = useState(false);
  if (!requester) return null;
  return (
    <span className="asker" title={t.askedBy(requester.name)}>
      {requester.avatar && !broken ? <img src={requester.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <span className="who-initial" aria-hidden="true">{requester.name.slice(0, 1).toUpperCase()}</span>}
      <span className="asker-name">{requester.name}</span>
    </span>
  );
}

function ArtistLinks({ text, refs, onArtist }: { text: string | null | undefined; refs?: ArtistRef[]; onArtist?: OpenArtist }) {
  if (!text) return null;
  if (!onArtist) return <>{text}</>;
  const link = (target: ArtistTarget, key?: string) => {
    const href = target.id ? `https://music.youtube.com/channel/${target.id}` : `https://music.youtube.com/search?q=${encodeURIComponent(target.name)}`;
    return <a key={key} href={href} className="artist-link" title={t.openArtist(target.name)} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return; event.preventDefault(); onArtist(target); }}>{target.name}</a>;
  };
  if (!refs?.length) return link({ name: text });
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const ref of refs) {
    const at = text.indexOf(ref.name, cursor);
    if (at < 0) continue;
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(link(ref, ref.id));
    cursor = at + ref.name.length;
  }
  if (!parts.length) return link({ name: text });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function AlbumLink({ target, onAlbum }: { target: AlbumTarget; onAlbum: (target: AlbumTarget) => void }) {
  const href = target.id ? `https://music.youtube.com/browse/${target.id}` : `https://music.youtube.com/search?q=${encodeURIComponent([target.name, target.artist].filter(Boolean).join(" "))}`;
  return <a href={href} className="artist-link" title={t.openAlbum(target.name)} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return; event.preventDefault(); onAlbum(target); }}>{target.name}</a>;
}

function FromPlaylist({ name }: { name: string }) {
  return <span className="from-list" title={t.fromPlaylist(name)}><Icon.List size={13} /><span className="from-list-name">{name}</span></span>;
}

function SongSub({ artist, requester, onArtist, playlist }: { artist?: string | null; requester?: Requester | null; onArtist?: OpenArtist; playlist?: { name: string } | null }) {
  if (!artist && !requester && !playlist) return null;
  return (
    <div className="sub">
      <ArtistLinks text={artist} onArtist={onArtist} />
      {artist && requester && <span aria-hidden="true"> · </span>}
      <Who requester={requester} />
      {playlist && (artist || requester) && <span aria-hidden="true"> · </span>}
      {playlist && <FromPlaylist name={playlist.name} />}
    </div>
  );
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
    let heardAt = 0;
    const lost = () => {
      attachSocket(null);
      if (closed) return;
      const now = performance.now();
      setView((current) => (current ? { ...current, positionMs: estimate(current, now), at: now, stale: true } : current));
      if (failures > 0) setLive(false);
      refresh();
      if (!poll) poll = setInterval(refresh, 10_000);
      later();
    };
    const watchdog = setInterval(() => {
      if (socket?.readyState !== WebSocket.OPEN || performance.now() - heardAt < SILENT_SOCKET_MS) return;
      const dead = socket;
      socket = undefined;
      dead.onclose = null;
      dead.onmessage = null;
      dead.close();
      lost();
    }, 5_000);
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
          heardAt = performance.now();
          failures = 0;
          attachSocket(live);
          setLive(true);
          stopPolling();
        };
        live.onmessage = (event) => {
          heardAt = performance.now();
          const message = JSON.parse(String(event.data)) as { type: "view"; view: View } | { type: "reply"; id: number; status: number; body: unknown } | { type: "beat" };
          if (message.type === "view") setView(stamp(message.view));
          else if (message.type === "reply") handleReply(message);
        };
        live.onclose = lost;
      } catch {
        if (!closed) later();
      }
    };
    if (!first.current) refresh();
    void connect();
    return () => {
      closed = true;
      clearInterval(watchdog);
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

const asItem = (song: Song): QueueItem => ({ query: song.url, title: song.title, artist: song.artist, artists: song.artists, album: song.album, albumId: song.albumId, artwork: song.artwork, durationMs: song.durationMs });

function SongRow({ song, done, disabled, onAdd, warm, onArtist, index, leaving, onLeft, withoutArtist, style, addLabel = t.addToQueue }: { song: Song; done: boolean; disabled: boolean; onAdd: () => void; warm: (song: Song) => void; onArtist?: OpenArtist; index?: number; leaving?: boolean; onLeft?: () => void; withoutArtist?: boolean; style?: CSSProperties; addLabel?: (title: string) => string }) {
  const album = song.album && <>{!withoutArtist && song.artist && " · "}{song.album}</>;
  return (
    <li className={`song ${leaving ? "leaving" : ""}`} style={style} onPointerEnter={() => warm(song)} onPointerDown={() => warm(song)} onFocus={() => warm(song)} onAnimationEnd={(event) => { if (leaving && event.animationName === "row-out") onLeft?.(); }}>
      {index !== undefined && <span className="num">{index}</span>}
      <Art src={artwork(song, 96)} className="art-md" />
      <div className="meta">
        <div className="name">{song.title}</div>
        <div className="sub">{!withoutArtist && <ArtistLinks text={song.artist} refs={song.artists} onArtist={onArtist} />}{album}</div>
      </div>
      {song.plays && <span className="plays">{song.plays}</span>}
      {song.durationMs > 0 && <span className="len">{clock(song.durationMs)}</span>}
      <button className={`icon-btn ring ${done ? "done" : ""}`} aria-label={done ? `${t.added}: ${song.title}` : addLabel(song.title)} disabled={disabled} onClick={onAdd}>{done ? <Icon.Check /> : <Icon.Plus />}</button>
    </li>
  );
}

const SETTLE_AFTER_TOUCH_MS = 4_000;

function useSteady<T>(path: string, seed: string) {
  const [items, setItems] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
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
    setLoading(true);
    const fetch = setTimeout(() => {
      get<T>(path).then((next) => {
        if (!current) return;
        setLoading(false);
        setFailed(false);
        pending.current = next;
        release();
      }, () => {
        if (!current) return;
        setLoading(false);
        setFailed(true);
      });
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
  return { items, version, hold, loading, failed };
}

const without = (set: Set<string>, id: string) => {
  const next = new Set(set);
  next.delete(id);
  return next;
};

function usePicked(onPick: (item: QueueItem) => Promise<void>) {
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  async function pick(song: Song) {
    setError(null);
    setAdded((previous) => new Set(previous).add(song.videoId));
    try {
      await onPick(asItem(song));
    } catch (failure) {
      setError(message(failure));
      setAdded((previous) => without(previous, song.videoId));
      setGone((previous) => without(previous, song.videoId));
    }
  }
  const leave = (id: string) => setGone((previous) => new Set(previous).add(id));
  return { added, gone, error, pick, leave };
}

function SkeletonSongs({ count }: { count: number }) {
  return (
    <ul className="rows" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="song">
          <div className="art art-md skeleton" />
          <div className="meta skeleton-text">
            <div className="skeleton line" style={{ width: `${70 - (index % 3) * 12}%` }} />
            <div className="skeleton line short" />
          </div>
        </li>
      ))}
    </ul>
  );
}

const STAGGER_ROWS = 10;
const staggered = (index: number) => ({ "--i": Math.min(index, STAGGER_ROWS) }) as CSSProperties;

const REFILL_BELOW = 10;

function Suggestions({ seedKey, label, onPick, hidden, onArtist, path = "suggestions", exclude, addLabel, warmUp = true, refill = false }: { seedKey: string; label: string; onPick: (item: QueueItem) => Promise<void>; hidden: boolean; onArtist?: OpenArtist; path?: string; exclude?: Set<string>; addLabel?: (title: string) => string; warmUp?: boolean; refill?: boolean }) {
  const [round, setRound] = useState(0);
  const { items: songs, version, hold, loading, failed } = useSteady<Song[]>(path, refill ? `${seedKey}:${round}` : seedKey);
  const { added, gone, error, pick, leave } = usePicked(onPick);
  const warm = useWarm(warmUp);
  const order = useRef<Song[]>([]);
  if (refill && songs) {
    const fresh = songs.filter((song) => !order.current.some((kept) => kept.videoId === song.videoId));
    if (fresh.length) order.current = [...order.current, ...fresh];
  }
  const pool = refill ? order.current : (songs ?? []);
  const shown = pool.filter((song) => !gone.has(song.videoId) && (added.has(song.videoId) || !exclude?.has(song.url)));
  const left = shown.filter((song) => !added.has(song.videoId)).length;
  const excluded = exclude?.size ?? 0;
  const askedAt = useRef(excluded);
  useEffect(() => {
    if (!refill || !songs || loading || left >= REFILL_BELOW || excluded <= askedAt.current) return;
    askedAt.current = excluded;
    setRound((count) => count + 1);
  }, [refill, songs, loading, left, excluded]);
  if (songs === null && !failed && !pool.length) {
    return (
      <section className="suggest-area" aria-label={label} aria-busy="true" hidden={hidden}>
        <h2 className="label">{label}<span className="label-spinner" aria-hidden="true" /></h2>
        <SkeletonSongs count={6} />
      </section>
    );
  }
  if (!shown.length) return null;
  return (
    <section className="suggest-area" aria-label={label} aria-busy={loading} hidden={hidden} {...hold}>
      <h2 className="label">{label}{refill && <span className="count">{left}</span>}{loading && <span className="label-spinner" aria-hidden="true" />}</h2>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className={`rows ${!refill && version ? "refreshed" : ""}`} key={refill ? "kept" : version}>
        {shown.map((song) => <SongRow key={song.videoId} song={song} done={added.has(song.videoId)} disabled={added.has(song.videoId)} leaving={added.has(song.videoId)} onLeft={() => leave(song.videoId)} onAdd={() => void pick(song)} warm={warm} onArtist={onArtist} addLabel={addLabel} />)}
      </ul>
    </section>
  );
}

const RECENT_SHOWN = 20;

function RecentlyPlayed({ seedKey, current, onPick, onArtist }: { seedKey: string; current: string | null; onPick: (item: QueueItem) => Promise<void>; onArtist: OpenArtist }) {
  const { items: entries, version, hold, failed } = useSteady<HistoryEntry[]>("history", seedKey);
  const { added, gone, pick, leave } = usePicked(onPick);
  const warm = useWarm(true);
  const seen = new Set<string>(current ? [current] : []);
  const songs: Song[] = [];
  for (const entry of entries ?? []) {
    const url = entry.url ?? entry.query;
    const id = url.match(/[?&]v=([\w-]{11})/)?.[1];
    if (!id || seen.has(url) || gone.has(id)) continue;
    seen.add(url);
    songs.push({ videoId: id, url, title: entry.title, artist: entry.artist ?? "", album: null, durationMs: entry.durationMs, artwork: entry.artwork, plays: null });
    if (songs.length === RECENT_SHOWN) break;
  }
  if (entries === null && !failed) {
    return (
      <section className="recent-area" aria-label={t.playedBefore} aria-busy="true">
        <h2 className="label">{t.playedBefore}</h2>
        <SkeletonSongs count={5} />
      </section>
    );
  }
  if (!songs.length) return null;
  return (
    <section className="recent-area" aria-label={t.playedBefore} {...hold}>
      <h2 className="label">{t.playedBefore}</h2>
      <ul className={`rows ${version ? "refreshed" : ""}`} key={version}>
        {songs.map((song) => <SongRow key={song.videoId} song={song} done={added.has(song.videoId)} disabled={added.has(song.videoId)} leaving={added.has(song.videoId)} onLeft={() => leave(song.videoId)} onAdd={() => void pick(song)} warm={warm} onArtist={onArtist} />)}
      </ul>
    </section>
  );
}

function ArtistAvatar({ artist, className }: { artist: Artist; className: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`artist-avatar ${className}`} style={{ "--h": hueOf(artist.id) } as CSSProperties}>
      {artist.avatar && !broken ? <img src={artist.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <span aria-hidden="true">{artist.name.slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

function SongSearch({ placeholder, onPick, onLink, warmUp, onActive, onArtist, collapsed, onType, exclude, leaveOnAdd, addLabel }: { placeholder: string; onPick: (item: QueueItem) => Promise<void>; onLink: (input: string) => Promise<void>; warmUp?: boolean; onActive?: (active: boolean) => void; onArtist?: OpenArtist; collapsed?: boolean; onType?: () => void; exclude?: Set<string>; leaveOnAdd?: boolean; addLabel?: (title: string) => string }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<Song[] | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [shown, setShown] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [gone, setGone] = useState<Set<string>>(new Set());
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
      const [songs, found] = await Promise.all([get<Song[]>(`search?q=${encodeURIComponent(query)}`), onArtist ? get<Artist[]>(`artists?q=${encodeURIComponent(query)}`).catch(() => []) : Promise.resolve([])]);
      if (id === sequence.current) {
        setResults(songs);
        setArtists(found);
        setShown(query);
      }
    } catch (failure) {
      if (id === sequence.current) setError(message(failure));
    }
    if (id === sequence.current) setLoading(false);
  }, [onArtist]);
  useEffect(() => {
    const query = text.trim();
    if (isLink(query) || query.length < 2) {
      sequence.current++;
      setResults(null);
      setArtists([]);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => void search(query), 250);
    return () => clearTimeout(timer);
  }, [text, search]);
  function clear() {
    setText("");
    setResults(null);
    setArtists([]);
    setAdded(new Set());
    setGone(new Set());
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
        <input value={text} data-search aria-keyshortcuts="/" onChange={(event) => { setText(event.target.value); onType?.(); }} onKeyDown={(event) => { if (event.key === "Escape") clear(); }} placeholder={placeholder} aria-label={placeholder} enterKeyHint={isLink(text) ? "go" : "search"} />
        {isLink(text) && <button className="pill primary" disabled={busy === "link"}>{busy === "link" ? t.adding : t.addLink}</button>}
        {text && <button type="button" className="icon-btn small" aria-label={t.clearSearch} onClick={clear}><Icon.Close /></button>}
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {!collapsed && artists.length > 0 && (
        <section aria-label={t.artists}>
          <h2 className="label">{t.artists}</h2>
          <ul className={`artist-cards arriving ${stale ? "stale" : ""}`} key={shown}>
            {artists.map((artist, index) => (
              <li key={artist.id} style={staggered(index)}>
                <button className="artist-card" disabled={stale} onClick={() => onArtist?.({ id: artist.id, name: artist.name })}>
                  <ArtistAvatar artist={artist} className="avatar-md" />
                  <span className="artist-card-text">
                    <span className="name">{artist.name}</span>
                    {artist.audience && <span className="sub">{artist.audience}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!collapsed && (loading || results) && (
        <section aria-label={t.songs} aria-busy={loading}>
          <h2 className="label">{t.songs}{loading && <span className="label-spinner" aria-hidden="true" />}</h2>
          {results?.length === 0 && <p className="hint arriving-hint">{t.noSongs}</p>}
          {!results && <SkeletonSongs count={5} />}
          <ul className={`rows arriving ${stale ? "stale" : ""}`} key={shown}>
            {results?.filter((song) => !gone.has(song.videoId) && (added.has(song.videoId) || !exclude?.has(song.url))).map((song, index) => <SongRow key={song.videoId} style={staggered(index + artists.length)} song={song} done={added.has(song.videoId)} disabled={stale || busy === song.videoId || Boolean(leaveOnAdd && added.has(song.videoId))} leaving={Boolean(leaveOnAdd && added.has(song.videoId) && busy !== song.videoId)} onLeft={() => setGone((previous) => new Set(previous).add(song.videoId))} onAdd={() => void pick(song)} warm={warm} onArtist={onArtist} addLabel={addLabel} />)}
          </ul>
        </section>
      )}
    </div>
  );
}

const TOP_SHOWN = 10;

function useLoad<T>(path: string): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ path: string; data: T | null; error: string | null }>({ path, data: null, error: null });
  useEffect(() => {
    let current = true;
    setState({ path, data: null, error: null });
    get<T>(path).then((data) => current && setState({ path, data, error: null }), (failure) => current && setState({ path, data: null, error: message(failure) }));
    return () => {
      current = false;
    };
  }, [path]);
  return state.path === path ? state : { data: null, error: null };
}

function useAddedSet(onPick: (item: QueueItem) => Promise<void>, onError: (error: string | null) => void) {
  const [added, setAdded] = useState<Set<string>>(new Set());
  async function pick(song: Song) {
    onError(null);
    setAdded((previous) => new Set(previous).add(song.videoId));
    try {
      await onPick(asItem(song));
    } catch (failure) {
      onError(message(failure));
      setAdded((previous) => without(previous, song.videoId));
    }
  }
  return { added, pick };
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy;
}

function ArtistSkeleton({ back }: { back: ReactNode }) {
  return (
    <>
      <div className="artist-hero loading">
        {back}
        <div className="artist-hero-body" aria-hidden="true">
          <div className="artist-hero-text">
            <p className="eyebrow">{t.artist}</p>
            <h2 className="artist-name"><span className="skeleton block name-block" /></h2>
            <p className="sub"><span className="skeleton block sub-block" /></p>
          </div>
          <div className="artist-actions">
            <span className="pill skeleton ghost-pill">{t.queueTop(TOP_SHOWN)}</span>
            <span className="pill skeleton ghost-pill">{t.shuffleTop(TOP_SHOWN)}</span>
          </div>
        </div>
      </div>
      <div aria-hidden="true">
        <h3 className="label">{t.topSongs}</h3>
        <SkeletonSongs count={6} />
      </div>
    </>
  );
}

function AlbumSkeleton() {
  return (
    <>
      <div className="album-head" aria-hidden="true">
        <div className="art art-album skeleton" />
        <div className="album-text">
          <p className="eyebrow"><span className="skeleton ghost-text">{t.release("album", null)}</span></p>
          <h2 className="album-title"><span className="skeleton block name-block" /></h2>
          <p className="sub"><span className="skeleton block sub-block" /></p>
          <span className="pill skeleton ghost-pill">{t.queueAll}</span>
        </div>
      </div>
      <SkeletonSongs count={8} />
    </>
  );
}

function ArtistView({ target, onBack, onOpen, onPick, onPickMany }: { target: ArtistTarget; onBack: () => void; onOpen: (entry: Browse) => void; onPick: (item: QueueItem) => Promise<void>; onPickMany: (items: QueueItem[]) => Promise<void> }) {
  const { data: page, error: loadError } = useLoad<ArtistPage>(target.id ? `artist?id=${encodeURIComponent(target.id)}` : `artist?name=${encodeURIComponent(target.name)}`);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const { added, pick } = useAddedSet(onPick, setError);
  const warm = useWarm(true);
  const [bannerBroken, setBannerBroken] = useState(false);
  const many = (items: Song[]) => async () => {
    setError(null);
    try {
      await onPickMany(items.map(asItem));
    } catch (failure) {
      setError(message(failure));
      throw failure;
    }
  };
  const back = <button className="pill hero-back" onClick={onBack}><Icon.Chevron />{t.goBack}</button>;
  if (!page) {
    return (
      <section className="browse" aria-label={target.name} aria-busy={!loadError}>
        {loadError ? <><div className="browse-bar">{back}</div><p className="error" role="alert">{loadError}</p></> : <ArtistSkeleton back={back} />}
      </section>
    );
  }
  const top = page.songs.slice(0, TOP_SHOWN);
  const songs = all ? page.songs : top;
  const banner = page.banner && !bannerBroken ? page.banner.replace(/=w\d+-h\d+/, "=w1440-h600") : null;
  return (
    <section className="browse" aria-label={page.name}>
      <div className="artist-hero" style={{ "--h": hueOf(page.id) } as CSSProperties}>
        {banner && <img src={banner} alt="" referrerPolicy="no-referrer" onError={() => setBannerBroken(true)} />}
        <div className="artist-hero-shade" />
        {back}
        <div className="artist-hero-body">
          <div className="artist-hero-text">
            <p className="eyebrow">{t.artist}</p>
            <h2 className="artist-name">{page.name}</h2>
            {page.audience && <p className="sub">{page.audience}</p>}
          </div>
          {top.length > 0 && (
            <div className="artist-actions">
              <QueueButton className="pill primary" label={t.queueTop(top.length)} run={many(top)} />
              <QueueButton className="pill glass" label={t.shuffleTop(top.length)} run={() => many(shuffled(top))()} />
            </div>
          )}
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {songs.length > 0 && (
        <div>
          <h3 className="label">{t.topSongs}</h3>
          <ol className="rows">
            {songs.map((song, index) => <SongRow key={song.videoId} song={song} index={index + 1} withoutArtist done={added.has(song.videoId)} disabled={added.has(song.videoId)} onAdd={() => void pick(song)} warm={warm} />)}
          </ol>
          {page.songs.length > TOP_SHOWN && <button className="pill show-all" onClick={() => setAll(!all)}>{all ? t.showFewer : t.showAllSongs(page.songs.length)}</button>}
        </div>
      )}
      {page.releases.length > 0 && (
        <div>
          <h3 className="label">{t.releases}</h3>
          <ul className="releases">
            {page.releases.map((release) => (
              <li key={release.id}>
                <button className="release" onClick={() => onOpen({ kind: "album", target: { id: release.id, name: release.title, artist: page.name } })}>
                  <Art src={release.artwork} className="art-release" />
                  <span className="name">{release.title}</span>
                  <span className="sub">{t.release(release.kind, release.year)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {page.related.length > 0 && (
        <div>
          <h3 className="label">{t.fansAlsoLike}</h3>
          <ul className="related">
            {page.related.map((artist) => (
              <li key={artist.id}>
                <button className="related-chip" onClick={() => onOpen({ kind: "artist", target: { id: artist.id, name: artist.name } })}>
                  <ArtistAvatar artist={artist} className="avatar-sm" />
                  {artist.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AlbumView({ target, onBack, onOpen, onPick, onPickMany }: { target: AlbumTarget; onBack: () => void; onOpen: (entry: Browse) => void; onPick: (item: QueueItem) => Promise<void>; onPickMany: (items: QueueItem[]) => Promise<void> }) {
  const lookup = new URLSearchParams(target.id ? { id: target.id } : { video: target.videoId ?? "", name: target.name, artist: target.artist ?? "" });
  const { data: album, error: loadError } = useLoad<Album>(`album?${lookup}`);
  const [error, setError] = useState<string | null>(null);
  const { added, pick } = useAddedSet(onPick, setError);
  const warm = useWarm(true);
  const back = <button className="pill hero-back" onClick={onBack}><Icon.Chevron />{t.goBack}</button>;
  if (!album) {
    return (
      <section className="browse" aria-busy={!loadError}>
        <div className="browse-bar">{back}</div>
        {loadError ? <p className="error" role="alert">{loadError}</p> : <AlbumSkeleton />}
      </section>
    );
  }
  const openArtist: OpenArtist = (target) => onOpen({ kind: "artist", target });
  return (
    <section className="browse" aria-label={album.title}>
      <div className="browse-bar">{back}</div>
      <div className="album-head">
        <Art src={album.artwork} className="art-album" />
        <div className="album-text">
          <p className="eyebrow">{t.release(album.kind, album.year)}</p>
          <h2 className="album-title">{album.title}</h2>
          <p className="sub"><ArtistLinks text={album.artist} onArtist={openArtist} /> · {t.songCount(album.songs.length)}</p>
          {album.songs.length > 0 && <QueueButton className="pill primary" label={t.queueAll} run={async () => {
            setError(null);
            try {
              await onPickMany(album.songs.map(asItem));
            } catch (failure) {
              setError(message(failure));
              throw failure;
            }
          }} />}
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <ol className="rows">
        {album.songs.map((song, index) => <SongRow key={song.videoId} song={{ ...song, album: null }} index={index + 1} withoutArtist done={added.has(song.videoId)} disabled={added.has(song.videoId)} onAdd={() => void pick(song)} warm={warm} />)}
      </ol>
    </section>
  );
}

function Browser({ entry, onBack, onOpen, onPick, onPickMany }: { entry: Browse; onBack: () => void; onOpen: (entry: Browse) => void; onPick: (item: QueueItem) => Promise<void>; onPickMany: (items: QueueItem[]) => Promise<void> }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = `${entry.kind}:${entry.target.id ?? entry.target.name}`;
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    if (box.top < 0 || box.top > innerHeight - 120) element.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [key]);
  return (
    <div className="browse-area" ref={ref} key={key}>
      {entry.kind === "artist" ? <ArtistView target={entry.target} onBack={onBack} onOpen={onOpen} onPick={onPick} onPickMany={onPickMany} /> : <AlbumView target={entry.target} onBack={onBack} onOpen={onOpen} onPick={onPick} onPickMany={onPickMany} />}
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
const waiting = (view: Synced): boolean => Boolean(view.loading || view.stalled || view.stale);
const stageOf = (view: Synced | null, track: Track | undefined): Stage => (!track || !view ? "idle" : waiting(view) ? "loading" : view.paused ? "paused" : "playing");

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
  return (
    <div className="cover">
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

const MARQUEE_PX_PER_S = 50;
const MARQUEE_HOLD_MS = 1_800;

function Marquee({ title, children }: { title: string; children: ReactNode }) {
  const box = useRef<HTMLHeadingElement>(null);
  const track = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  useEffect(() => {
    const outer = box.current;
    const inner = track.current;
    if (!outer || !inner) return;
    const measure = () => {
      const fade = parseFloat(getComputedStyle(outer).getPropertyValue("--fade")) || 0;
      const overflow = inner.scrollWidth - outer.clientWidth;
      setShift(overflow > 1 ? Math.ceil(overflow + fade) : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [title]);
  useEffect(() => {
    const inner = track.current;
    if (!inner || !shift || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const moving = (shift / MARQUEE_PX_PER_S) * 1000;
    const total = moving + MARQUEE_HOLD_MS;
    const held = MARQUEE_HOLD_MS / 2 / total;
    const animation = inner.animate([{ transform: "translateX(0)", offset: 0 }, { transform: "translateX(0)", offset: held, easing: "ease-in-out" }, { transform: `translateX(-${shift}px)`, offset: 1 - held }, { transform: `translateX(-${shift}px)`, offset: 1 }], { duration: total, iterations: Infinity, direction: "alternate" });
    return () => animation.cancel();
  }, [shift]);
  return (
    <h1 ref={box} className={`title marquee ${shift ? "scrolling" : ""}`} title={title}>
      <span ref={track} className="marquee-track">{children}</span>
    </h1>
  );
}

function Listeners({ count, people }: { count: number; people: Listener[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  useEffect(() => {
    if (!people.length) setOpen(false);
  }, [people.length]);
  const label = <><span className="live-dot" aria-hidden="true" /><Icon.Headphones />{t.listeners(count)}</>;
  if (!people.length) return <p className="listeners">{label}</p>;
  const stack = people.slice(0, 4);
  return (
    <div className="listeners-box" ref={box}>
      <button className="listeners listeners-btn" aria-expanded={open} aria-haspopup="true" title={people.map((person) => person.name).join(", ")} onClick={() => setOpen(!open)}>
        <span className="face-stack" aria-hidden="true">
          {stack.map((person) => <Face key={person.id} person={person} />)}
          {people.length > stack.length && <span className="face more">+{people.length - stack.length}</span>}
        </span>
        {label}
      </button>
      {open && (
        <div className="people-pop" role="dialog" aria-label={t.whoListens}>
          <p className="label">{t.whoListens}</p>
          <ul>
            {people.map((person) => <li key={person.id}><Face person={person} />{person.name}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function Face({ person }: { person: Listener }) {
  const [broken, setBroken] = useState(false);
  return person.avatar && !broken ? <img className="face" src={person.avatar} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <span className="face">{person.name.slice(0, 1).toUpperCase()}</span>;
}

function NowPlaying({ view, track, command, onArtist, onAlbum }: { view: Synced | null; track: Track | undefined; command: (body: Command) => Promise<void>; onArtist: OpenArtist; onAlbum: (target: AlbumTarget) => void }) {
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
        <p className="eyebrow"><Equalizer />{view.stale ? t.lostBot : view.loading ? t.starting : view.stalled ? t.buffering : view.paused ? t.paused : t.nowPlaying}</p>
        <div className="swap" key={track.query}>
          <Marquee title={track.title}>{track.url ? <a href={track.url} target="_blank" rel="noreferrer">{track.title}</a> : track.title}</Marquee>
          <p className="artist">
            {track.artist ? <ArtistLinks text={track.artist} refs={track.artists} onArtist={onArtist} /> : !track.album && "\u00a0"}
            {track.album && <span className="album-part">{track.artist && <span aria-hidden="true"> · </span>}<AlbumLink target={{ id: track.albumId, name: track.album, artist: track.artists?.[0]?.name ?? track.artist, videoId: (track.url ?? track.query).match(/[?&]v=([\w-]{11})/)?.[1] ?? null }} onAlbum={onAlbum} /></span>}
          </p>
          <p className="asked-by">
            {track.requestedBy === "autoplay" ? (
              <span className="tag auto-tag">{track.pickedBy === "explore" ? <Icon.Compass size={13} /> : <Icon.Radio size={13} />}{t.autoplay}</span>
            ) : track.requester ? (
              <><span>{t.askedFor}</span><Who requester={track.requester} />{track.playlist && <><span aria-hidden="true">·</span><FromPlaylist name={track.playlist.name} /></>}</>
            ) : "\u00a0"}
          </p>
        </div>
      </div>
      <div className={`progress ${waiting(view) ? "loading" : ""}`}>
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
        <button className={`play ${waiting(view) ? "busy" : ""}`} aria-label={view.loading ? t.starting : view.paused ? t.resume : t.pause} aria-busy={waiting(view)} aria-keyshortcuts="Space K" title={`${view.paused ? t.resume : t.pause} (K)`} onClick={() => void command({ action: view.paused ? "resume" : "pause" })}><PlayIcon paused={view.paused} /></button>
        <span className="transport-side">
          <button className="icon-btn" aria-label={t.skip} aria-keyshortcuts="N" title={`${t.skip} (N)`} onClick={() => void command({ action: "skip" })}><Icon.Skip /></button>
          <button className={`icon-btn ${view.loop !== "off" ? "on" : ""}`} aria-label={`${t.loop}: ${loopNames[view.loop]}`} title={`${t.loop}: ${loopNames[view.loop]}`} onClick={() => void command({ action: "loop", loop: LOOP_ORDER[(loopIndex + 1) % LOOP_ORDER.length] })}>
            <Icon.Repeat />
            {view.loop === "track" && <span className="badge">1</span>}
          </button>
        </span>
      </div>
      <div className="now-foot">
        <Listeners count={view.listeners} people={view.people ?? []} />
        <button className="pill danger" title={t.disconnectHelp} onClick={() => void command({ action: "stop" })}>{t.disconnect}</button>
      </div>
    </section>
  );
}

function NowShape() {
  return (
    <section className="now" data-stage="loading" aria-busy="true">
      <div className="cover"><div className="art art-hero skeleton" /></div>
      <div className="now-text" aria-hidden="true">
        <div className="skeleton line short" />
        <div className="skeleton line wide" />
        <div className="skeleton line" />
      </div>
      <div className="progress loading" aria-hidden="true">
        <div className="track-line" />
        <div className="time"><span>–:––</span><span>–:––</span></div>
      </div>
      <div className="transport" aria-hidden="true">
        <span className="transport-side start">
          <button className="icon-btn" tabIndex={-1} disabled><Icon.Shuffle /></button>
          <button className="icon-btn" tabIndex={-1} disabled><Icon.Previous /></button>
        </span>
        <button className="play busy" tabIndex={-1} disabled><PlayIcon paused /></button>
        <span className="transport-side">
          <button className="icon-btn" tabIndex={-1} disabled><Icon.Skip /></button>
          <button className="icon-btn" tabIndex={-1} disabled><Icon.Repeat /></button>
        </span>
      </div>
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
        <div className="sub">{view.stale ? t.lostBot : view.loading ? t.starting : view.stalled ? t.buffering : track.artist}</div>
      </div>
      <button className={`play small ${waiting(view) ? "busy" : ""}`} aria-label={view.loading ? t.starting : view.paused ? t.resume : t.pause} onClick={() => void command({ action: view.paused ? "resume" : "pause" })}><PlayIcon paused={view.paused} /></button>
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

function QueueList({ upcoming, offset, command, onArtist }: { upcoming: Track[]; offset: number; command: (body: Command) => Promise<void>; onArtist: OpenArtist }) {
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
              <SongSub artist={item.artist} requester={item.requester} onArtist={onArtist} playlist={item.playlist} />
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

function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  const last = useRef(children);
  if (open) last.current = children;
  return (
    <div className="reveal" data-open={open} inert={!open}>
      <div><div className="reveal-body">{open ? children : last.current}</div></div>
    </div>
  );
}

function PlayerTab({ me, view, setView, refresh, live, onOpenList }: { me: Me; view: Synced | null; setView: (view: Synced) => void; refresh: () => void; live: boolean; onOpenList: (id: string) => void }) {
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
  const [browse, setBrowse] = useState<Browse[]>([]);
  const openBrowse = useCallback((entry: Browse) => setBrowse((stack) => [...stack.slice(-19), entry]), []);
  const openArtist = useCallback<OpenArtist>((target) => openBrowse({ kind: "artist", target }), [openBrowse]);
  const openAlbum = useCallback((target: AlbumTarget) => openBrowse({ kind: "album", target }), [openBrowse]);
  const closeBrowse = useCallback(() => setBrowse((stack) => (stack.length ? [] : stack)), []);
  const browsing = browse.at(-1);
  const seedKey = view?.active ? (view.tracks[view.current]?.query ?? "end") : view ? "idle" : "";
  async function add(item: QueueItem) {
    if (view) setView(predictAdd(view, item));
    try {
      await enqueue({ items: [item] });
    } catch (failure) {
      refresh();
      throw failure;
    }
  }
  async function addMany(items: QueueItem[]) {
    if (view) setView(items.reduce(predictAdd, view));
    try {
      await enqueue({ items });
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
  const autoplays = view?.active && view.autoplay ? view.autoplayUpcoming : [];
  const shape: Shape | null = view ? (track ? "playing" : "idle") : null;
  useEffect(() => {
    if (shape) keepShape(shape);
  }, [shape]);
  const nowRef = useRef<HTMLDivElement>(null);
  const docked = useOffscreen(() => nowRef.current?.querySelector(".transport"), track?.id ?? null);
  return (
    <>
      {!live && <p className="notice" role="status">{t.offline}</p>}
      <div className="player">
        <div className="now-col" ref={nowRef}>
          <div className="now-stage">
            {view && !track ? <IdleStage me={me} command={command} onOpenList={onOpenList} onError={setError} /> : <NowPlaying view={view} track={track} command={command} onArtist={openArtist} onAlbum={openAlbum} />}
            <div className="now-extras">
              <Reveal open={Boolean(error)}><p className="error" role="alert">{error}</p></Reveal>
              <Reveal open={Boolean(skipped)}><p className="notice" role="status">{skipped && t.skippedFailed(skipped)}</p></Reveal>
            </div>
          </div>
        </div>
        <div className="side">
          <div className="discover-col">
            <SongSearch warmUp placeholder={t.playerSearchPlaceholder} onPick={add} onLink={(input) => enqueue({ input })} onActive={setSearching} onArtist={openArtist} collapsed={Boolean(browsing)} onType={closeBrowse} />
            {browsing && <Browser entry={browsing} onBack={() => setBrowse((stack) => stack.slice(0, -1))} onOpen={openBrowse} onPick={add} onPickMany={addMany} />}
            {seedKey && <Suggestions seedKey={seedKey} label={track ? t.suggested : t.forYou} onPick={add} hidden={searching || Boolean(browsing)} onArtist={openArtist} />}
          </div>
          <div className="queue-col">
            {track && (
              <section className="queue-area" aria-label={t.queue}>
                <div className="label-row">
                  <h2 className="label">{t.queue}{upcoming.length > 0 && <span className="count">{upcoming.length}</span>}</h2>
                  {upcoming.length > 0 && <button className="pill ghost" onClick={() => void command({ action: "clear" })}>{t.clear}</button>}
                </div>
                {upcoming.length === 0 && view?.loop !== "queue" && <p className="hint">{t.queueEmpty}</p>}
                {upcoming.length > 0 && <QueueList upcoming={upcoming} offset={offset} command={command} onArtist={openArtist} />}
                {view?.loop === "queue" && <FromTop tracks={view.tracks} />}
                {view && <AutoplayBlock view={view} command={command} />}
                {view && view.loop === "off" && autoplays.length > 0 && (
                  <div className="auto-group">
                    <ol className="rows">
                      {autoplays.map((pick) => (
                        <li key={pick.id} className={`song auto-row ${pick.replacing ? "replacing" : ""}`} aria-busy={pick.replacing}>
                          <span className="grip" title={t.autoplayModeHelp[pick.pickedBy ?? "session"]}>{pick.pickedBy === "explore" ? <Icon.Compass /> : <Icon.Radio />}</span>
                          <Art src={artwork(pick, 96)} className="art-sm" />
                          <div className="meta">
                            <div className="name">{pick.title}</div>
                            {pick.artist && <div className="sub"><ArtistLinks text={pick.artist} onArtist={openArtist} /></div>}
                          </div>
                          {pick.durationMs > 0 && <span className="len">{clock(pick.durationMs)}</span>}
                          <button className="icon-btn small swap" aria-label={t.swapPick(pick.title)} title={t.swapPick(pick.title)} disabled={pick.replacing} onClick={() => void command({ action: "swapPick", id: pick.id })}><Icon.Swap /></button>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </section>
            )}
            {seedKey && <RecentlyPlayed seedKey={seedKey} current={track?.url ?? null} onPick={add} onArtist={openArtist} />}
          </div>
        </div>
      </div>
      {track && view && <Dock view={view} track={track} command={command} shown={docked} />}
    </>
  );
}

const FROM_TOP_SHOWN = 3;

function FromTop({ tracks }: { tracks: Track[] }) {
  if (!tracks.length) return null;
  const shown = tracks.slice(0, FROM_TOP_SHOWN);
  return (
    <div className="from-top">
      <p className="auto-label from-top-label"><Icon.Repeat /><span>{t.fromTop}</span><span className="count">{tracks.length}</span></p>
      <ol className="rows">
        {shown.map((track, index) => (
          <li key={track.id} className="song from-top-row">
            <span className="num">{index + 1}</span>
            <Art src={artwork(track, 96)} className="art-sm" />
            <div className="meta">
              <div className="name">{track.title}</div>
              <SongSub artist={track.artist} requester={track.requester} />
            </div>
            {track.durationMs > 0 && <span className="len">{clock(track.durationMs)}</span>}
          </li>
        ))}
      </ol>
      {tracks.length > shown.length && <p className="hint">{t.fromTopMore(tracks.length - shown.length)}</p>}
    </div>
  );
}

function AutoplayBlock({ view, command }: { view: Synced; command: (body: Command) => Promise<void> }) {
  const held = view.loop !== "off";
  const minutes = Math.max(0, Math.ceil(((view.autoplayEndsAt ?? 0) - Date.now()) / 60000));
  return (
    <div className={`auto-block ${held ? "held" : ""}`}>
      <div className="auto-head">
        <p className="auto-label"><span>{held && view.autoplay ? `${t.thenAutoplay} · ${t.autoplayModes[view.autoplayMode]}` : t.thenAutoplay}</span></p>
        <label className="switch">
          <input type="checkbox" role="switch" aria-label={t.autoplay} checked={view.autoplay} disabled={held} onChange={(event) => void command({ action: "autoplay", on: event.target.checked })} />
          <span className="knob" aria-hidden="true" />
        </label>
      </div>
      {held ? (
        <p className="hint">{t.autoplayOnHold}</p>
      ) : !view.autoplay ? (
        <p className="hint">{t.autoplayOff}</p>
      ) : (
        <>
          <div className="modes" role="radiogroup" aria-label={t.autoplayMode}>
            {(["session", "explore"] as const).map((mode) => (
              <button key={mode} className="mode" role="radio" aria-checked={view.autoplayMode === mode} onClick={() => void command({ action: "autoplayMode", mode })}>
                <span className="mode-icon">{mode === "session" ? <Icon.Radio size={16} /> : <Icon.Compass size={16} />}</span>
                <span className="mode-text">
                  <span className="mode-name">{t.autoplayModes[mode]}</span>
                  <span className="mode-help">{t.autoplayModeShort[mode]}</span>
                </span>
              </button>
            ))}
          </div>
          {view.autoplayEndsAt && (
            <div className="autoplay-note">
              <span className="sub">{t.autoplayEnds(minutes)}</span>
              <button className="pill ghost accent" onClick={() => void command({ action: "keepGoing" })}>{t.keepGoing}</button>
            </div>
          )}
          {!view.autoplayUpcoming.length && <p className="hint">{t.autoplayPicking}</p>}
        </>
      )}
    </div>
  );
}

function useCached<T>(path: string | null): { data: T | null; failed: boolean; reload: () => Promise<unknown> } {
  const [, bump] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => onCache(() => bump((count) => count + 1)), []);
  useEffect(() => {
    if (path) load<T>(path).then(() => setFailed(false), () => setFailed(true));
  }, [path]);
  const reload = useCallback(() => (path ? load<T>(path) : Promise.resolve()), [path]);
  return { data: path ? (cached<T>(path) ?? null) : null, failed, reload };
}

function hueOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

function Tile({ seed, className }: { seed: string; className?: string }) {
  return <div className={`tile ${className ?? ""}`} style={{ "--h": hueOf(seed) } as CSSProperties}><Icon.Note size={28} /></div>;
}

const coverAt = (cover: string, size: number) => (cover.includes("i.ytimg.com") ? (size > 200 ? cover.replace("mqdefault", "hqdefault") : cover) : cover.replace(/=w\d+-h\d+/, `=w${size}-h${size}`));

function PlaylistCover({ list, className }: { list: Playlist; className?: string }) {
  if (!list.covers.length) return <Tile seed={list.id} className={`cover-grid ${className ?? ""}`} />;
  const covers = list.covers.length >= 4 ? list.covers.slice(0, 4) : list.covers.slice(0, 1);
  return (
    <div className={`cover-grid ${covers.length === 4 ? "four" : ""} ${className ?? ""}`} aria-hidden="true">
      {covers.map((cover, index) => <Art key={index} src={coverAt(cover, covers.length === 4 ? 226 : 544)} className="cover-cell" />)}
    </div>
  );
}

function OwnerFace({ name }: { name: string }) {
  return <span className="owner-face" style={{ "--h": hueOf(name) } as CSSProperties} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>;
}

const LockIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
const GlobeIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
const PencilIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>;
const TrashIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>;

const VisibilityIcon = ({ visibility }: { visibility: Visibility }) => (visibility === "private" ? <LockIcon /> : <GlobeIcon />);

const playlistMeta = (list: Playlist) => [t.tracks(list.trackCount), list.durationMs > 0 ? spanOf(list.durationMs) : null].filter(Boolean).join(" · ");

async function playTracks(list: Playlist, shuffle: boolean): Promise<void> {
  const tracks = await load<PlaylistTrack[]>(`playlist/tracks?id=${list.id}`);
  if (!tracks.length) throw new ApiError("noResults");
  const playlist = { id: list.id, name: list.name };
  await enqueue({ items: (shuffle ? shuffled(tracks) : tracks).map((track) => ({ query: track.query, title: track.title, artist: track.artist, artwork: track.artwork, durationMs: track.durationMs, playlist })) });
}

function PlaylistCard({ list, mine, onOpen, onError }: { list: Playlist; mine: boolean; onOpen: () => void; onError: (text: string) => void }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  useEffect(() => {
    if (state !== "done") return;
    const timer = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [state]);
  const play = () => {
    setState("busy");
    playTracks(list, false).then(() => setState("done"), (failure: unknown) => { setState("idle"); onError(message(failure)); });
  };
  return (
    <li className="playlist-card">
      <button className="playlist-open" onClick={onOpen} onPointerEnter={() => prefetch(`playlist/tracks?id=${list.id}`)} onFocus={() => prefetch(`playlist/tracks?id=${list.id}`)}>
        <PlaylistCover list={list} />
        <span className="name">{list.name}</span>
        <span className="sub playlist-meta">
          {!mine && <><span className="owner"><OwnerFace name={list.ownerName} />{list.ownerName}</span><span aria-hidden="true">·</span></>}
          {mine && list.visibility === "private" && <span className="vis private" title={t.visibility.private}><LockIcon /><span className="sr-only">{t.visibility.private}</span></span>}
          <span>{mine ? playlistMeta(list) : t.tracks(list.trackCount)}</span>
        </span>
      </button>
      {list.trackCount > 0 && <button className={`card-play ${state}`} aria-label={`${t.play}: ${list.name}`} disabled={state === "busy"} onClick={play}>{state === "done" ? <Icon.Check /> : <Icon.Play />}</button>}
    </li>
  );
}

function CreatePlaylist({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await post<{ id: string }>("playlists", { name, visibility });
      await load("playlists");
      onCreated(id);
    } catch (failure) {
      setError(message(failure));
      setBusy(false);
    }
  }
  return (
    <form className="create-card" aria-label={t.newPlaylistButton} onSubmit={(event) => void submit(event)}>
      <input className="field create-field" aria-label={t.playlistName} placeholder={t.playlistName} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") onCancel(); }} maxLength={100} autoFocus />
      <VisibilityToggle value={visibility} className="pill" onChange={setVisibility} />
      <div className="create-actions">
        <button type="button" className="pill" onClick={onCancel}>{t.cancel}</button>
        <button className="pill primary" disabled={!name.trim() || busy}>{t.create}</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

function PlaylistsTab({ me, open, setOpen }: { me: Me; open: string | null; setOpen: (id: string | null, replace?: boolean) => void }) {
  const { data: lists, failed } = useCached<Playlist[]>("playlists");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = lists?.find((entry) => entry.id === open);
  if (open && list) return <PlaylistView list={list} me={me} onBack={(replace) => setOpen(null, replace)} />;
  if (open && lists) return <PlaylistGone onBack={() => setOpen(null, true)} />;
  const needle = filter.trim().toLowerCase();
  const matching = (lists ?? []).filter((entry) => !needle || entry.name.toLowerCase().includes(needle) || entry.ownerName.toLowerCase().includes(needle));
  const mine = matching.filter((entry) => entry.ownerId === me.discordId);
  const group = matching.filter((entry) => entry.ownerId !== me.discordId);
  const section = (label: string, entries: Playlist[], own: boolean) => entries.length > 0 && (
    <section className="playlist-section" aria-label={label}>
      <h2 className="section-title">{label} <span>{entries.length}</span></h2>
      <ul className="playlist-grid">
        {entries.map((entry) => <PlaylistCard key={entry.id} list={entry} mine={own} onOpen={() => setOpen(entry.id)} onError={setError} />)}
      </ul>
    </section>
  );
  return (
    <section className="sheet playlists" aria-label={t.tabs.playlists}>
      <div className="sheet-head">
        <div className="sheet-heading">
          <h1 className="sheet-title">{t.tabs.playlists}</h1>
          <p className="sub">{t.playlistsIntro}</p>
        </div>
        {(lists?.length ?? 0) > 0 && (
          <label className="find">
            <Icon.Search />
            <input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t.findPlaylist} aria-label={t.findPlaylist} />
          </label>
        )}
        <button className="pill primary new-playlist" aria-expanded={creating} onClick={() => setCreating(!creating)}><Icon.Plus />{t.newPlaylistButton}</button>
      </div>
      <Reveal open={creating}>{creating && <CreatePlaylist onCancel={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpen(id); }} />}</Reveal>
      {error && <p className="error" role="alert">{error}</p>}
      {!lists && !failed && <PlaylistsSkeleton />}
      {failed && !lists && <p className="error" role="alert">{t.errors.failed}</p>}
      {lists?.length === 0 && <p className="hint">{t.noPlaylists}</p>}
      {lists && lists.length > 0 && !matching.length && <p className="hint">{t.noPlaylistMatch}</p>}
      {section(t.yours, mine, true)}
      {section(t.fromGroup, group, false)}
    </section>
  );
}

function PlaylistsSkeleton() {
  return (
    <section className="playlist-section" aria-hidden="true">
      <div className="skeleton line section-skeleton" />
      <ul className="playlist-grid">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index} className="playlist-card">
            <div className="playlist-open">
              <div className="cover-grid skeleton" />
              <div className="skeleton line" style={{ width: `${75 - (index % 3) * 15}%` }} />
              <div className="skeleton line short" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlaylistGone({ onBack }: { onBack: () => void }) {
  return (
    <section className="sheet playlists">
      <button className="pill ghost back" onClick={onBack}><Icon.Back />{t.back}</button>
      <p className="hint">{t.playlistGone}</p>
    </section>
  );
}

function VisibilityToggle({ value, className, onChange }: { value: Visibility; className: string; onChange: (visibility: Visibility) => void }) {
  return (
    <button type="button" className={`${className} vis-toggle ${value}`} aria-label={`${t.whoCanSee}: ${t.visibility[value]}`} title={t.visibilityLong[value]} onClick={() => onChange(value === "public" ? "private" : "public")}>
      <VisibilityIcon visibility={value} />
      <span className="vis-label">
        {(["public", "private"] as const).map((entry) => <span key={entry} className={entry === value ? "on" : ""} aria-hidden="true">{t.visibility[entry]}</span>)}
      </span>
    </button>
  );
}

function PlaylistTitle({ list, owned, onRename }: { list: Playlist; owned: boolean; onRename: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  if (editing) {
    const done = () => {
      setEditing(false);
      if (name.trim() && name.trim() !== list.name) void onRename(name.trim());
      else setName(list.name);
    };
    return (
      <form className="title-edit" onSubmit={(event) => { event.preventDefault(); done(); }}>
        <input className="playlist-title" value={name} maxLength={100} aria-label={t.rename} autoFocus onChange={(event) => setName(event.target.value)} onBlur={done} onKeyDown={(event) => { if (event.key === "Escape") { setName(list.name); setEditing(false); } }} />
      </form>
    );
  }
  return (
    <div className="title-row">
      <h1 className="playlist-title">{list.name}</h1>
      {owned && <button className="icon-btn small" aria-label={t.rename} title={t.rename} onClick={() => { setName(list.name); setEditing(true); }}><PencilIcon /></button>}
    </div>
  );
}

function PlaylistView({ list, me, onBack }: { list: Playlist; me: Me; onBack: (replace?: boolean) => void }) {
  const path = `playlist/tracks?id=${list.id}`;
  const { data: tracks, failed } = useCached<PlaylistTrack[]>(path);
  const [error, setError] = useState<string | null>(null);
  const owned = list.ownerId === me.discordId;
  const refresh = () => Promise.all([load(path), load("playlists")]);
  const act = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await refresh();
    } catch (failure) {
      setError(message(failure));
    }
  };
  const run = (shuffle: boolean) => async () => {
    setError(null);
    try {
      await playTracks(list, shuffle);
    } catch (failure) {
      setError(message(failure));
      throw failure;
    }
  };
  const move = (track: PlaylistTrack, to: number) => {
    if (!tracks) return;
    const next = tracks.filter((entry) => entry.id !== track.id);
    next.splice(to, 0, track);
    remember(path, next);
    void act(() => post("playlist/move", { id: list.id, trackId: track.id, to }));
  };
  const removeTrack = (track: PlaylistTrack) => {
    if (tracks) remember(path, tracks.filter((entry) => entry.id !== track.id));
    void act(() => post("playlist/remove", { id: list.id, trackId: track.id }));
  };
  const have = new Set(tracks?.map((track) => track.query));
  const [searching, setSearching] = useState(false);
  const addItem = async (item: QueueItem) => {
    await post("playlist/add", { id: list.id, items: [item] });
    await refresh();
  };
  const songs = (
    <section className={`panel playlist-songs ${owned ? "" : "wide"}`} aria-label={t.songs}>
      {error && <p className="error" role="alert">{error}</p>}
      {!tracks && !failed && <SkeletonSongs count={8} />}
      {tracks?.length === 0 && <p className="hint">{owned ? t.emptyOwnList : t.emptyList}</p>}
      {tracks && tracks.length > 0 && (
        <ol className="rows">
          {tracks.map((track, index) => (
            <li key={track.id} className="song">
              <span className="num">{index + 1}</span>
              <Art src={artwork(track, 96)} className="art-md" />
              <div className="meta">
                <div className="name">{track.title}</div>
                {track.artist && <div className="sub">{track.artist}</div>}
              </div>
              {track.durationMs > 0 && <span className="len">{clock(track.durationMs)}</span>}
              {owned && (
                <span className="row-tools">
                  <button className="icon-btn small" aria-label={`${t.up}: ${track.title}`} disabled={index === 0} onClick={() => move(track, index - 1)}><Icon.Up /></button>
                  <button className="icon-btn small" aria-label={`${t.down}: ${track.title}`} disabled={index === tracks.length - 1} onClick={() => move(track, index + 1)}><Icon.Down /></button>
                  <button className="icon-btn small" aria-label={`${t.remove}: ${track.title}`} onClick={() => removeTrack(track)}><Icon.Close /></button>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
  return (
    <section className="sheet playlists" aria-label={list.name}>
      <button className="pill ghost back" onClick={() => onBack()}><Icon.Back />{t.back}</button>
      <div className="playlist-hero">
        <PlaylistCover list={list} className="cover-hero" />
        <div className="playlist-hero-text">
          <PlaylistTitle key={list.name} list={list} owned={owned} onRename={(name) => act(() => post("playlist/rename", { id: list.id, name }))} />
          <p className="sub playlist-owner">{list.visibility === "private" && <span className="vis private" title={t.visibility.private}><LockIcon /><span className="sr-only">{t.visibility.private}</span></span>}<OwnerFace name={list.ownerName} /><span className="owner-name">{list.ownerName}</span><span aria-hidden="true">·</span>{playlistMeta(list)}</p>
          <div className="row playlist-actions">
            <QueueButton className="btn primary play-all" label={t.play} disabled={!list.trackCount} run={run(false)} />
            <QueueButton className="btn" label={t.shuffle} disabled={list.trackCount < 2} run={run(true)} />
            {owned && <VisibilityToggle value={list.visibility} className="btn" onChange={(visibility) => void act(() => post("playlist/visibility", { id: list.id, visibility }))} />}
            {owned && <button className="icon-btn delete-list" aria-label={t.deletePlaylist} title={t.deletePlaylist} onClick={() => { if (confirm(t.confirmDelete(list.name))) void act(async () => { await post("playlist/delete", { id: list.id }); onBack(true); }); }}><TrashIcon /></button>}
          </div>
        </div>
      </div>
      {owned ? (
        <div className="playlist-body">
          {songs}
          <section className="panel playlist-add" aria-label={t.addSongs}>
            <h2 className="section-title">{t.addSongs}</h2>
            <SongSearch placeholder={t.addToList} exclude={have} leaveOnAdd addLabel={t.addToThisList} onActive={setSearching} onPick={addItem} onLink={async (input) => { await post("playlist/add", { id: list.id, input }); await refresh(); }} />
            {tracks && tracks.length > 0 && <Suggestions path={`playlist/suggestions?id=${list.id}`} seedKey={list.id} label={t.fitsThisList} exclude={have} addLabel={t.addToThisList} warmUp={false} refill hidden={searching} onPick={addItem} />}
          </section>
        </div>
      ) : songs}
    </section>
  );
}

function QueueButton({ className, label, icon, disabled, run }: { className: string; label: string; icon?: ReactNode; disabled?: boolean; run: () => Promise<void> }) {
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
  return <button className={`${className} ${state === "done" ? "done" : ""}`} disabled={disabled || state === "busy"} aria-live="polite" onClick={click}>{state === "idle" && icon}{state === "busy" ? t.adding : state === "done" ? t.queued : label}</button>;
}

const SESSION_ROWS = 8;

const timeOf = (time: number) => new Date(time).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
const shortDay = (time: number) => new Date(time).toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" });

function relativeDay(time: number): string {
  const day = new Date(time).toDateString();
  if (day === new Date().toDateString()) return t.today;
  if (day === new Date(Date.now() - 86_400_000).toDateString()) return t.yesterday;
  return shortDay(time);
}

function spanOf(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
}

const sessionRange = (session: SessionSummary) => `${timeOf(session.startedAt)}–${session.live ? t.liveNow.toLowerCase() : timeOf(session.endedAt ?? session.startedAt)}`;

async function queueSession(loadTracks: () => Promise<SessionTrack[]>): Promise<void> {
  const list = await loadTracks();
  await enqueue({ items: list.map((track) => ({ query: track.url ?? track.query, title: track.title, artist: track.artist, artwork: track.artwork, durationMs: track.durationMs })) });
}

const IDLE_SLEEVES = 3;
const SHAPE_KEY = "dj.stage";

type Shape = "idle" | "playing";

function lastShape(): Shape {
  try {
    return localStorage.getItem(SHAPE_KEY) === "idle" ? "idle" : "playing";
  } catch {
    return "playing";
  }
}

function keepShape(shape: Shape): void {
  try {
    localStorage.setItem(SHAPE_KEY, shape);
  } catch {
    return;
  }
}

function IdleShape() {
  return (
    <section className="idle-stage waiting" aria-busy="true">
      <div className="crate" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => <div key={index} className="art crate-card skeleton" />)}
      </div>
      <div className="idle-text" aria-hidden="true">
        <div className="skeleton line short" />
        <div className="skeleton line wide" />
        <div className="skeleton line" />
        <div className="idle-actions">
          <span className="skeleton pill-shape" />
          <span className="skeleton pill-shape small" />
        </div>
        <div className="skeleton line short" />
      </div>
      <div className="idle-sleeves" aria-hidden="true">
        <div className="skeleton label-line" />
        <ul className="sleeve-grid">
          {[0, 1, 2].map((index) => (
            <li key={index} className="sleeve-shape">
              <div className="skeleton cover-grid" />
              <div className="skeleton line" />
            </li>
          ))}
        </ul>
      </div>
      <span className="skeleton pill-shape hint" />
    </section>
  );
}

function IdleStage({ me, command, onOpenList, onError }: { me: Me; command: (body: Command) => Promise<void>; onOpenList: (id: string) => void; onError: (text: string) => void }) {
  const { data: sessions, failed } = useCached<SessionSummary[]>("sessions");
  const { data: lists } = useCached<Playlist[]>("playlists");
  const last = sessions?.find((session) => !session.live && session.songs > 0);
  const playable = (lists ?? []).filter((list) => list.trackCount > 0);
  const sleeves = [...playable.filter((list) => list.ownerId === me.discordId), ...playable.filter((list) => list.ownerId !== me.discordId)].slice(0, IDLE_SLEEVES);
  const waiting = !sessions && !failed;
  const covers = last ? last.artworks : (sleeves[0]?.covers ?? []);
  const report = (failure: unknown) => {
    onError(message(failure));
    throw failure;
  };
  const sessionTracks = async () => {
    const path = `session/tracks?id=${last?.id}`;
    return cached<SessionTrack[]>(path) ?? load<SessionTrack[]>(path);
  };
  const radio = async () => {
    const [first] = await get<Song[]>("suggestions");
    if (!first) throw new ApiError("noResults");
    await enqueue({ items: [asItem(first)] });
    await command({ action: "autoplay", on: true });
  };
  if (waiting) return <IdleShape />;
  const radioButton = (primary: boolean) => <QueueButton className={`pill ${primary ? "primary" : "ghost"} big`} icon={<Icon.Radio size={17} />} label={t.startRadio} run={() => radio().catch(report)} />;
  return (
    <section className="idle-stage" aria-label={t.tabs.player}>
      <div className="crate" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => <Art key={index} src={covers[index] ?? null} className="crate-card" />)}
      </div>
      {last ? (
        <div className="idle-text">
          <p className="eyebrow">{t.lastTime(`${relativeDay(last.startedAt)}, ${sessionRange(last)}`)}</p>
          <h1 className="idle-title">{t.pickUp}</h1>
          <p className="idle-meta">
            {last.requesters.length > 0 && (
              <span className="stack" aria-hidden="true">
                {last.requesters.slice(0, 3).map((person) => (person.avatar ? <img key={person.id} src={person.avatar} alt="" referrerPolicy="no-referrer" /> : <span key={person.id} className="who-initial">{person.name.slice(0, 1).toUpperCase()}</span>))}
              </span>
            )}
            <span>{[last.requesters.map((person) => person.name).filter(Boolean).slice(0, 3).join(", "), t.sessionMeta(spanOf((last.endedAt ?? last.startedAt) - last.startedAt), last.songs, false)].filter(Boolean).join(" · ")}</span>
          </p>
          <div className="idle-actions">
            <QueueButton className="pill primary big" icon={<Icon.Play />} label={t.queueItAgain} run={() => queueSession(sessionTracks).catch(report)} />
            <QueueButton className="pill big" icon={<Icon.Shuffle />} label={t.shuffle} run={() => queueSession(async () => shuffled(await sessionTracks())).catch(report)} />
          </div>
          <div className="idle-actions">{radioButton(false)}</div>
        </div>
      ) : (
        <div className="idle-text">
          <h1 className="idle-title">{t.nothing}</h1>
          <p className="idle-meta">{t.radioHint}</p>
          <div className="idle-actions">{radioButton(true)}</div>
        </div>
      )}
      {sleeves.length > 0 && (
        <div className="idle-sleeves">
          <h2 className="label">{t.orPutOn}</h2>
          <ul className="sleeve-grid">
            {sleeves.map((list) => <PlaylistCard key={list.id} list={list} mine={list.ownerId === me.discordId} onOpen={() => onOpenList(list.id)} onError={onError} />)}
          </ul>
        </div>
      )}
      <p className="join-hint"><Icon.Headphones />{t.joinHint}</p>
    </section>
  );
}

function HistoryTab({ me }: { me: Me }) {
  const { data: sessions, failed } = useCached<SessionSummary[]>("sessions");
  const [chosen, setChosen] = useState<number | null | undefined>(undefined);
  const open = chosen === undefined ? (sessions?.[0]?.id ?? null) : chosen;
  const setOpen = setChosen;
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <section className="sheet history" aria-label={t.tabs.history}>
      <p className="hint history-intro">{t.historyIntro}</p>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {(sessions?.length === 0 || (failed && !sessions)) && <p className="hint">{t.noHistory}</p>}
      {sessions?.map((session) => (
        <SessionCard key={session.id} session={session} me={me} open={open === session.id} onToggle={() => setOpen(open === session.id ? null : session.id)} onNotice={(text) => { setError(null); setNotice(text); }} onError={(text) => { setNotice(null); setError(text); }} />
      ))}
    </section>
  );
}

function SessionCard({ session, me, open, onToggle, onNotice, onError }: { session: SessionSummary; me: Me; open: boolean; onToggle: () => void; onNotice: (text: string) => void; onError: (text: string) => void }) {
  const path = `session/tracks?id=${session.id}`;
  const { data: tracks } = useCached<SessionTrack[]>(open ? path : null);
  const [all, setAll] = useState(false);
  const [menu, setMenu] = useState(false);
  const loadTracks = useCallback(async () => cached<SessionTrack[]>(path) ?? load<SessionTrack[]>(path), [path]);
  const span = (session.endedAt ?? Date.now()) - session.startedAt;
  const heading = `${relativeDay(session.startedAt)}, ${sessionRange(session)}`;
  const rows = tracks ? [...tracks].reverse() : [];
  const shown = all ? rows : rows.slice(0, SESSION_ROWS);
  const fail = (failure: unknown) => {
    onError(message(failure));
    throw failure;
  };
  const queueAgain = () => queueSession(loadTracks).catch(fail);
  const save = async () => {
    const name = t.sessionPlaylist(`${shortDay(session.startedAt)} ${sessionRange(session)}`);
    await post("playlist/from-session", { sessionId: session.id, name }).catch(fail);
    onNotice(t.savedAs(name));
  };
  return (
    <article className={`session-card ${session.live ? "live" : ""}`} aria-label={heading}>
      <div className="session-head">
        <button className="session-toggle" aria-expanded={open} aria-label={open ? t.hideSongs : t.showSongs} onClick={onToggle}>
          <span className="mosaic" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => <Art key={index} src={session.artworks[index] ?? null} className="art-tile" />)}
          </span>
          <span className="session-text">
            <span className="session-title">
              {session.live && <span className="now-pill"><span className="live-dot" aria-hidden="true" />{t.liveNow}</span>}
              {heading}
            </span>
            <span className="session-meta">
              <span>{t.sessionMeta(spanOf(span), session.songs, session.live)}</span>
              {session.requesters.length > 0 && (
                <span className="people">
                  <span className="stack" aria-hidden="true">
                    {session.requesters.slice(0, 4).map((person) => (person.avatar ? <img key={person.id} src={person.avatar} alt="" referrerPolicy="no-referrer" /> : <span key={person.id} className="who-initial">{person.name.slice(0, 1).toUpperCase()}</span>))}
                  </span>
                  {session.requesters.map((person) => person.name).filter(Boolean).join(", ")}
                </span>
              )}
              {session.autoplay > 0 && <span className="auto-count"><Icon.Radio size={13} />{t.autoplayCount(session.autoplay)}</span>}
            </span>
          </span>
          <span className={`chevron ${open ? "open" : ""}`} aria-hidden="true"><Icon.Down /></span>
        </button>
        <div className="session-actions">
          <QueueButton className="pill primary" label={t.requeue} run={queueAgain} />
          <QueueButton className="pill" label={t.saveAsPlaylist} run={save} />
          <span className="menu-anchor">
            <button className="pill" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu(!menu)}>{t.addToPlaylist}<Icon.Down /></button>
            {menu && <MergeMenu me={me} session={session} onClose={() => setMenu(false)} onNotice={onNotice} onError={onError} />}
          </span>
        </div>
      </div>
      {open && (
        <div className="session-songs">
          {!tracks && <p className="hint">…</p>}
          <ol className="rows">
            {shown.map((track, index) => {
              const playing = session.live && index === 0;
              return (
                <li key={track.id} className={`song session-row ${playing ? "playing" : ""}`}>
                  <span className="when">{playing ? <><Equalizer />{t.liveNow}</> : timeOf(track.playedAt)}</span>
                  <Art src={artwork(track, 96)} className="art-sm" />
                  <div className="meta">
                    <div className="name">{track.url ? <a href={track.url} target="_blank" rel="noreferrer">{track.title}</a> : track.title}</div>
                    <div className="sub">{track.artist}</div>
                  </div>
                  <span className="asked">{track.requestedBy === "autoplay" ? <span className="tag auto-tag">{track.pickedBy === "explore" ? <Icon.Compass size={13} /> : <Icon.Radio size={13} />}{t.autoplay}</span> : <Who requester={track.requester} />}</span>
                  {track.durationMs > 0 && <span className="len">{clock(track.durationMs)}</span>}
                  <QueueButton className="pill" label={t.requeue} run={() => enqueue({ items: [{ query: track.url ?? track.query, title: track.title, artist: track.artist, artwork: track.artwork, durationMs: track.durationMs }] }).catch(fail)} />
                </li>
              );
            })}
          </ol>
          {!all && rows.length > SESSION_ROWS && <button className="pill ghost show-all" onClick={() => setAll(true)}>{t.showAll(rows.length)}</button>}
        </div>
      )}
    </article>
  );
}

function MergeMenu({ me, session, onClose, onNotice, onError }: { me: Me; session: SessionSummary; onClose: () => void; onNotice: (text: string) => void; onError: (text: string) => void }) {
  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const own = (all: Playlist[]) => all.filter((list) => list.ownerId === me.discordId);
    const known = cached<Playlist[]>("playlists");
    if (known) setLists(own(known));
    load<Playlist[]>("playlists").then((all) => setLists(own(all)), () => setLists((previous) => previous ?? []));
  }, [me.discordId]);
  useEffect(() => {
    const away = (event: PointerEvent) => {
      if (!box.current?.parentElement?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);
  const shown = (lists ?? []).filter((list) => list.name.toLowerCase().includes(filter.trim().toLowerCase()));
  async function merge(list: Playlist) {
    setBusy(list.id);
    try {
      const result = await post<{ added: number; skipped: number }>("playlist/merge-session", { id: list.id, sessionId: session.id });
      onNotice(t.merged(list.name, result.added, result.skipped));
      onClose();
    } catch (failure) {
      onError(message(failure));
      setBusy(null);
    }
  }
  return (
    <div className="merge-menu" role="menu" ref={box}>
      <p className="merge-title">{t.addSongsTo(session.songs)}</p>
      <input className="merge-find" type="search" placeholder={t.findPlaylist} aria-label={t.findPlaylist} value={filter} onChange={(event) => setFilter(event.target.value)} autoFocus />
      {lists?.length === 0 && <p className="hint">{t.noOwnPlaylists}</p>}
      <ul className="merge-lists">
        {shown.map((list) => (
          <li key={list.id}>
            <button role="menuitem" disabled={busy !== null} onClick={() => void merge(list)}>
              <Tile seed={list.id} className="tile-sm" />
              <span className="merge-name"><span>{list.name}</span><span className="sub">{t.tracks(list.trackCount)}</span></span>
              {busy === list.id && <span className="sub">{t.adding}</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="merge-note">{t.mergeNote}</p>
    </div>
  );
}

function SettingsTab() {
  const { data: loaded, failed } = useCached<SettingsData>("settings");
  const [draft, setData] = useState<SettingsData | null>(null);
  const data = draft ?? loaded;
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data) return failed ? <p className="error" role="alert">{t.errors.failed}</p> : <SettingsSkeleton />;
  return (
    <form className="panel narrow" aria-label={t.tabs.settings} onSubmit={(event) => { event.preventDefault(); setSaved(false); setError(null); post<SettingsData>("settings", { djRoleId: data.djRoleId }).then((next) => { remember("settings", next); setData(null); setSaved(true); }, (failure: unknown) => setError(message(failure))); }}>
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

function SettingsSkeleton() {
  return (
    <div className="panel narrow" aria-hidden="true">
      <div className="skeleton line short" />
      <div className="field skeleton" />
      <div className="skeleton line" />
    </div>
  );
}

const TAB_DATA: Partial<Record<Tab, string>> = { playlists: "playlists", history: "sessions", settings: "settings" };
const PREFETCH_AFTER_MS = 1_200;

function usePrefetch(me: Me | null, live: boolean): void {
  useEffect(() => {
    if (!me || !live) return;
    const timer = setTimeout(() => {
      if (me.canPlay) {
        prefetch("playlists");
        if (!cached("sessions")) load<SessionSummary[]>("sessions").then((list) => list[0] && prefetch(`session/tracks?id=${list[0].id}`), () => undefined);
      }
      if (me.canManage) prefetch("settings");
    }, PREFETCH_AFTER_MS);
    return () => clearTimeout(timer);
  }, [me, live]);
}

function LangSwitch() {
  return (
    <div className="lang-switch" role="group" aria-label={t.language}>
      {LANGS.map((entry) => <button key={entry.code} lang={entry.code} aria-label={entry.name} title={entry.name} aria-pressed={lang === entry.code} onClick={() => { if (lang !== entry.code) switchLang(); }}>{entry.code.toUpperCase()}</button>)}
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="skeleton-rows" aria-hidden="true">
      <div className="skeleton line label-line" />
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton-row">
          <div className="skeleton art-md" />
          <div className="skeleton-text">
            <div className="skeleton line" style={{ width: `${70 - (index % 3) * 12}%` }} />
            <div className="skeleton line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Brand() {
  return <div className="brand"><span className="mark"><Icon.Note size={18} /></span><span>DJ</span></div>;
}

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);
  const [route, go] = useRoute();
  const tab = route.tab;
  const { view, live, setView, refresh } = useView(me);
  usePrefetch(me, live);
  const playingNow = view?.active ? view.tracks[view.current] : undefined;
  const tabTitle = playingNow ? `${view && waiting(view) ? "…" : view?.paused ? "❚❚" : "▶"} ${[playingNow.title, playingNow.artist].filter(Boolean).join(" · ")} · DJ` : BASE_TITLE;
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
        if (next.idle) {
          remember("sessions", next.idle.sessions);
          remember("playlists", next.idle.playlists);
        }
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
  const waitingForRole = Boolean(me?.member && !me.canPlay && !me.canManage);
  useEffect(() => {
    if (!waitingForRole) return;
    const timer = setInterval(() => get<Me>("me").then((next) => { if (next.canPlay || next.canManage) setMe(next); }, () => undefined), ROLE_RECHECK_MS);
    return () => clearInterval(timer);
  }, [waitingForRole]);
  if (!me) {
    const shape = lastShape();
    return (
      <>
        <Ambient src={null} paused />
        <div className="page" aria-busy="true">
          <header className="top">
            <Brand />
            <nav className="tabs waiting" aria-hidden="true">
              {(["player", "playlists", "history"] as const).map((entry) => <button key={entry} tabIndex={-1} disabled aria-selected={entry === "player"}>{t.tabs[entry]}</button>)}
            </nav>
            <div className="who">
              <LangSwitch />
              <span className="avatar skeleton" aria-hidden="true" />
            </div>
          </header>
          {failed && <p className="notice" role="status">{t.reconnecting}</p>}
          <main className="main">
            <div className="player">
              <div className="now-col">
                <div className="now-stage">{shape === "idle" ? <IdleShape /> : <NowShape />}</div>
              </div>
              <div className="side">
                <div className="discover-col">
                  <div className="skeleton search-line" />
                  <SkeletonRows count={6} />
                </div>
                <div className="queue-col">
                  <SkeletonRows count={5} />
                </div>
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
              {tabs.map((entry) => <button key={entry} role="tab" aria-selected={active === entry} onClick={() => go({ tab: entry, list: null })} onPointerEnter={() => { const path = TAB_DATA[entry]; if (path) prefetch(path); }}>{t.tabs[entry]}</button>)}
            </nav>
          )}
          <div className="who">
            <LangSwitch />
            {me.user.image ? <img className="avatar" src={me.user.image} alt={me.user.name} title={me.user.name} referrerPolicy="no-referrer" /> : <span className="avatar" title={me.user.name}>{me.user.name.slice(0, 1).toUpperCase()}</span>}
          </div>
        </header>
        {!me.member && <p className="notice">{t.notMember}</p>}
        {me.member && !me.canPlay && <p className="notice">{t.denied}</p>}
        <main className="main">
          {active === "player" && <PlayerTab me={me} view={view} setView={setView} refresh={refresh} live={live} onOpenList={(id) => go({ tab: "playlists", list: id })} />}
          {active === "playlists" && <PlaylistsTab me={me} open={route.list} setOpen={(id, replace) => go({ tab: "playlists", list: id }, replace)} />}
          {active === "history" && <HistoryTab me={me} />}
          {active === "settings" && <SettingsTab />}
        </main>
      </div>
    </>
  );
}
