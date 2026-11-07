import { type CSSProperties, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, get, type HistoryEntry, type Loop, type Me, type Playlist, type PlaylistTrack, post, type SettingsData, signIn, type Song, type Track, type View } from "./api";
import { lang, switchLang, t } from "./i18n";
import * as Icon from "./icons";

type Tab = "player" | "playlists" | "history" | "settings";
type QueueItem = { query: string; title?: string; artist?: string | null; artwork?: string | null; durationMs?: number };

const message = (error: unknown) => t.errors[error instanceof ApiError ? error.message : "failed"] ?? t.errors.failed!;
const isLink = (text: string) => /^https?:\/\//.test(text.trim());
const LOOP_ORDER: Loop[] = ["off", "queue", "track"];

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

function useView(enabled: boolean): { view: View | null; live: boolean; refresh: () => void; setView: (view: View) => void } {
  const [view, setView] = useState<View | null>(null);
  const [live, setLive] = useState(true);
  const refresh = useCallback(() => {
    get<View>("state").then(setView, () => undefined);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let closed = false;
    let socket: WebSocket | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const stopPolling = () => {
      if (poll) clearInterval(poll);
      poll = undefined;
    };
    const connect = async () => {
      try {
        const { ticket, url } = await get<{ ticket: string; url: string }>("ticket");
        if (closed) return;
        socket = new WebSocket(`${url}?ticket=${encodeURIComponent(ticket)}`);
        socket.onopen = () => {
          setLive(true);
          stopPolling();
        };
        socket.onmessage = (event) => setView(JSON.parse(String(event.data)) as View);
        socket.onclose = () => {
          if (closed) return;
          setLive(false);
          refresh();
          if (!poll) poll = setInterval(refresh, 10_000);
          retry = setTimeout(() => void connect(), 30_000);
        };
      } catch {
        if (!closed) retry = setTimeout(() => void connect(), 30_000);
      }
    };
    refresh();
    void connect();
    return () => {
      closed = true;
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

function SongSearch({ placeholder, onPick, onLink }: { placeholder: string; onPick: (item: QueueItem) => Promise<void>; onLink: (input: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<Song[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const search = useCallback(async (query: string) => {
    const id = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const songs = await get<Song[]>(`search?q=${encodeURIComponent(query)}`);
      if (id === sequence.current) setResults(songs);
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
    const timer = setTimeout(() => void search(query), 450);
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
    try {
      await onPick({ query: song.url, title: song.title, artist: song.artist, artwork: song.artwork, durationMs: song.durationMs });
      setAdded((previous) => new Set(previous).add(song.videoId));
    } catch (failure) {
      setError(message(failure));
    }
    setBusy(null);
  }
  return (
    <div className="search">
      <form role="search" onSubmit={(event) => void submit(event)} className="search-box">
        <Icon.Search />
        <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") clear(); }} placeholder={placeholder} aria-label={placeholder} enterKeyHint={isLink(text) ? "go" : "search"} />
        {isLink(text) && <button className="pill primary" disabled={busy === "link"}>{busy === "link" ? t.adding : t.addLink}</button>}
        {text && <button type="button" className="icon-btn small" aria-label={t.clearSearch} onClick={clear}><Icon.Close /></button>}
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {results === null && !loading && !error && <p className="hint">{t.searchHint}</p>}
      {(loading || results) && (
        <section aria-label={t.songs} aria-busy={loading}>
          <h2 className="label">{loading && !results ? t.searching : t.songs}</h2>
          {results?.length === 0 && <p className="hint">{t.noSongs}</p>}
          <ul className="rows">
            {results?.map((song) => {
              const done = added.has(song.videoId);
              return (
                <li key={song.videoId} className="song">
                  <Art src={artwork(song, 96)} className="art-md" />
                  <div className="meta">
                    <div className="name">{song.title}</div>
                    <div className="sub">{[song.artist, song.album].filter(Boolean).join(" · ")}</div>
                  </div>
                  {song.plays && <span className="plays">{song.plays}</span>}
                  {song.durationMs > 0 && <span className="len">{clock(song.durationMs)}</span>}
                  <button className={`icon-btn ring ${done ? "done" : ""}`} aria-label={done ? `${t.added}: ${song.title}` : t.addToQueue(song.title)} disabled={busy === song.videoId} onClick={() => void pick(song)}>{done ? <Icon.Check /> : <Icon.Plus />}</button>
                </li>
              );
            })}
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

function NowPlaying({ view, track, command }: { view: View | null; track: Track | undefined; command: (body: Record<string, unknown>) => Promise<void> }) {
  const [now, setNow] = useState(Date.now());
  const [seek, setSeek] = useState<number | null>(null);
  const seen = useRef({ position: view?.positionMs ?? 0, at: Date.now() });
  useEffect(() => {
    seen.current = { position: view?.positionMs ?? 0, at: Date.now() };
  }, [view?.positionMs]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
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
  const estimated = view.paused ? view.positionMs : seen.current.position + (now - seen.current.at);
  const duration = track.durationMs;
  const position = seek ?? Math.min(estimated, duration || estimated);
  const loopIndex = LOOP_ORDER.indexOf(view.loop);
  const loopNames: Record<Loop, string> = { off: t.loopOff, track: t.loopTrack, queue: t.loopQueue };
  return (
    <section className="now" aria-label={t.tabs.player}>
      <Art src={artwork(track, 544)} className="art-hero" />
      <div>
        <h1 className="title">{track.url ? <a href={track.url} target="_blank" rel="noreferrer">{track.title}</a> : track.title}</h1>
        {track.artist && <p className="sub">{track.artist}</p>}
      </div>
      <div className="progress">
        {duration > 0 ? (
          <Slider label={t.position} value={position} max={duration} step={1000} onChange={setSeek} onCommit={() => { if (seek !== null) { void command({ action: "seek", positionMs: seek }); setSeek(null); } }} className="bright" />
        ) : <div className="track-line" />}
        <div className="time"><span>{clock(position)}</span><span>{duration > 0 ? clock(duration) : "–:––"}</span></div>
      </div>
      <div className="transport">
        <span className="transport-side start">
          <button className="icon-btn" aria-label={t.shuffle} onClick={() => void command({ action: "shuffle" })}><Icon.Shuffle /></button>
        </span>
        <button className="play" aria-label={view.paused ? t.resume : t.pause} onClick={() => void command({ action: view.paused ? "resume" : "pause" })}>{view.paused ? <Icon.Play /> : <Icon.Pause />}</button>
        <span className="transport-side">
        <button className="icon-btn" aria-label={t.skip} onClick={() => void command({ action: "skip" })}><Icon.Skip /></button>
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
          <span className="sub">{t.autoplayEnds(Math.max(0, Math.ceil((view.autoplayEndsAt - now) / 60000)))}</span>
          <button className="pill" onClick={() => void command({ action: "keepGoing" })}>{t.keepGoing}</button>
        </div>
      )}
    </section>
  );
}

function PlayerTab({ view, setView, live }: { view: View | null; setView: (view: View) => void; live: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  async function command(body: Record<string, unknown>) {
    setError(null);
    try {
      setView(await post<View>("command", { command: body }));
    } catch (failure) {
      setError(message(failure));
    }
  }
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
          {view && <p className="fine">{[track ? t.listeners(view.listeners) : null, t.usage(view.hoursThisMonth, view.hourLimit)].filter(Boolean).join(" · ")}</p>}
        </div>
        <div className="side">
          <SongSearch placeholder={t.searchPlaceholder} onPick={(item) => enqueue({ items: [item] })} onLink={(input) => enqueue({ input })} />
          {track && (
            <section aria-label={t.queue}>
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
  const play = (items: PlaylistTrack[]) => act(() => enqueue({ items: items.map(({ query, title }) => ({ query, title })) }));
  if (list) {
    return (
      <section className="card" aria-label={list.name}>
        <div><button className="linkish" style={{ paddingLeft: 0 }} onClick={() => setOpen(null)}>← {t.back}</button></div>
        <div>
          <h2 className="title">{list.name}</h2>
          <p className="dim">{t.by(list.ownerName)} · {t.tracks(tracks.length)}</p>
        </div>
        <div className="row">
          <button className="btn primary" disabled={!tracks.length} onClick={() => void play(tracks)}>{t.play}</button>
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
            <button className="btn small" onClick={() => { setError(null); enqueue({ items: [{ query: entry.url ?? entry.query, title: entry.title }] }).catch((failure: unknown) => setError(message(failure))); }}>{t.requeue}</button>
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
    <form className="card" aria-label={t.tabs.settings} onSubmit={(event) => { event.preventDefault(); setSaved(false); setError(null); post<SettingsData>("settings", { djRoleId: data.djRoleId, hourLimit: data.hourLimit }).then((next) => { setData(next); setSaved(true); }, (failure: unknown) => setError(message(failure))); }}>
      <label className="stack">{t.djRole}
        <select className="field" value={data.djRoleId ?? ""} onChange={(event) => setData({ ...data, djRoleId: event.target.value || null })}>
          <option value="">{t.noRole}</option>
          {data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </label>
      <p className="dim">{t.djRoleHelp}</p>
      <label className="stack">{t.hourLimit}
        <input className="field" type="number" min={0} max={744} value={data.hourLimit} onChange={(event) => setData({ ...data, hourLimit: Number(event.target.value) })} />
      </label>
      <p className="dim">{t.hourLimitHelp}</p>
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
  const { view, live, setView } = useView(Boolean(me?.canPlay));
  useEffect(() => {
    document.documentElement.lang = lang;
    get<Me>("me").then(setMe, (error: unknown) => {
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
  if (!me) return null;
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
        {active === "player" && <PlayerTab view={view} setView={setView} live={live} />}
        {active === "playlists" && <PlaylistsTab me={me} />}
        {active === "history" && <HistoryTab />}
        {active === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}
