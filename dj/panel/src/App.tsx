import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, get, type HistoryEntry, type Loop, type Me, type Playlist, type PlaylistTrack, post, type SettingsData, signIn, type View } from "./api";
import { lang, switchLang, t } from "./i18n";

type Tab = "player" | "playlists" | "history" | "settings";

const message = (error: unknown) => t.errors[error instanceof ApiError ? error.message : "failed"] ?? t.errors.failed!;

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
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

function AddForm({ placeholder, label, onAdd }: { placeholder: string; label: string; onAdd: (input: string) => Promise<void> }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(input.trim());
      setInput("");
    } catch (failure) {
      setError(message(failure));
    }
    setBusy(false);
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="row" aria-label={placeholder}>
      <input className="field grow" value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      <button className="btn primary" disabled={busy}>{busy ? t.adding : label}</button>
      {error && <p className="error" role="alert" style={{ flexBasis: "100%" }}>{error}</p>}
    </form>
  );
}

function PlayerTab({ view, setView, live }: { view: View | null; setView: (view: View) => void; live: boolean }) {
  const [now, setNow] = useState(Date.now());
  const [seek, setSeek] = useState<number | null>(null);
  const [volume, setVolume] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const seen = useRef({ position: 0, at: Date.now() });
  useEffect(() => {
    seen.current = { position: view?.positionMs ?? 0, at: Date.now() };
  }, [view?.positionMs]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
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
  const estimated = view && !view.paused ? seen.current.position + (now - seen.current.at) : (view?.positionMs ?? 0);
  const duration = track?.durationMs ?? 0;
  const position = seek ?? Math.min(estimated, duration || estimated);
  const offset = (view?.current ?? 0) + 1;
  return (
    <>
      {!live && <p className="notice" role="status">{t.offline}</p>}
      <section className="card" aria-label={t.tabs.player}>
        {track ? (
          <>
            <div>
              <h2 className="title">{track.url ? <a href={track.url} target="_blank" rel="noreferrer">{track.title}</a> : track.title}</h2>
              <p className="dim">{t.listeners(view?.listeners ?? 0)}</p>
            </div>
            {duration > 0 && (
              <div>
                <input type="range" aria-label={t.position} min={0} max={duration} step={1000} value={position} onChange={(event) => setSeek(Number(event.target.value))} onPointerUp={() => { if (seek !== null) { void command({ action: "seek", positionMs: seek }); setSeek(null); } }} onKeyUp={() => { if (seek !== null) { void command({ action: "seek", positionMs: seek }); setSeek(null); } }} />
                <div className="time"><span>{clock(position)}</span><span>{clock(duration)}</span></div>
              </div>
            )}
            <div className="controls">
              <button className="btn primary" onClick={() => void command({ action: view?.paused ? "resume" : "pause" })}>{view?.paused ? t.resume : t.pause}</button>
              <button className="btn" onClick={() => void command({ action: "skip" })}>{t.skip}</button>
              <button className="btn" onClick={() => void command({ action: "shuffle" })}>{t.shuffle}</button>
              <button className="btn danger" onClick={() => void command({ action: "stop" })}>{t.stop}</button>
            </div>
            <div className="split">
              <label className="stack">{t.volume}
                <input type="range" min={0} max={200} step={5} value={volume ?? Math.round((view?.volume ?? 1) * 100)} onChange={(event) => setVolume(Number(event.target.value))} onPointerUp={() => { if (volume !== null) { void command({ action: "volume", volume: volume / 100 }); setVolume(null); } }} onKeyUp={() => { if (volume !== null) { void command({ action: "volume", volume: volume / 100 }); setVolume(null); } }} />
              </label>
              <label className="stack">{t.loop}
                <select className="field" value={view?.loop ?? "off"} onChange={(event) => void command({ action: "loop", loop: event.target.value as Loop })}>
                  <option value="off">{t.loopOff}</option>
                  <option value="track">{t.loopTrack}</option>
                  <option value="queue">{t.loopQueue}</option>
                </select>
              </label>
            </div>
            <div className="row">
              <label className="row grow"><input type="checkbox" checked={view?.autoplay ?? false} onChange={(event) => void command({ action: "autoplay", on: event.target.checked })} /> {t.autoplay}</label>
              {view?.autoplay && view.autoplayEndsAt && (
                <>
                  <span className="dim">{t.autoplayEnds(Math.max(0, Math.ceil((view.autoplayEndsAt - now) / 60000)))}</span>
                  <button className="btn" onClick={() => void command({ action: "keepGoing" })}>{t.keepGoing}</button>
                </>
              )}
            </div>
          </>
        ) : (
          <div>
            <h2 className="title">{t.nothing}</h2>
            <p className="dim">{t.nothingHint}</p>
          </div>
        )}
        <AddForm placeholder={t.addPlaceholder} label={t.add} onAdd={async (input) => { const result = await post<{ ok: boolean; reason?: string }>("enqueue", { input }); if (!result.ok) throw new ApiError(result.reason ?? "failed"); }} />
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      {track && (
        <section className="card" aria-label={t.queue}>
          <div className="row">
            <h2 className="section grow">{t.queue}</h2>
            {upcoming.length > 0 && <button className="btn small" onClick={() => void command({ action: "clear" })}>{t.clear}</button>}
          </div>
          {upcoming.length === 0 ? <p className="dim">{t.queueEmpty}</p> : (
            <ol className="list">
              {upcoming.map((item, index) => (
                <li key={item.id} className={`item ${dragging === item.id ? "dragging" : ""}`} draggable onDragStart={() => setDragging(item.id)} onDragEnd={() => setDragging(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragging && dragging !== item.id) void command({ action: "move", id: dragging, to: offset + index }); setDragging(null); }}>
                  <span className="num">{index + 1}</span>
                  <span className="name">{item.title}</span>
                  <button className="btn small" aria-label={`${t.up}: ${item.title}`} disabled={index === 0} onClick={() => void command({ action: "move", id: item.id, to: offset + index - 1 })}>↑</button>
                  <button className="btn small" aria-label={`${t.down}: ${item.title}`} disabled={index === upcoming.length - 1} onClick={() => void command({ action: "move", id: item.id, to: offset + index + 1 })}>↓</button>
                  <button className="btn small" aria-label={`${t.remove}: ${item.title}`} onClick={() => void command({ action: "remove", id: item.id })}>✕</button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {view && <p className="dim">{t.usage(view.hoursThisMonth, view.hourLimit)}</p>}
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
  const play = (items: PlaylistTrack[]) => act(async () => {
    const result = await post<{ ok: boolean; reason?: string }>("enqueue", { items: items.map(({ query, title }) => ({ query, title })) });
    if (!result.ok) throw new ApiError(result.reason ?? "failed");
  });
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
        {owned && <AddForm placeholder={t.addToList} label={t.add} onAdd={async (input) => { await post("playlist/add", { id: list.id, input }); await reload(); await reloadTracks(list.id); }} />}
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
            <button className="btn small" onClick={() => { setError(null); post<{ ok: boolean; reason?: string }>("enqueue", { items: [{ query: entry.url ?? entry.query, title: entry.title }] }).then((result) => { if (!result.ok) throw new ApiError(result.reason ?? "failed"); }).catch((failure: unknown) => setError(message(failure))); }}>{t.requeue}</button>
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
        <h1 className="brand">DJ</h1>
        <span className="dim">{me.user.name}</span>
        <button className="linkish" onClick={switchLang}>{t.language}</button>
      </header>
      {!me.member && <p className="notice">{t.notMember}</p>}
      {me.member && !me.canPlay && <p className="notice">{t.denied}</p>}
      {tabs.length > 0 && (
        <nav className="tabs" role="tablist">
          {tabs.map((entry) => <button key={entry} role="tab" aria-selected={active === entry} onClick={() => setTab(entry)}>{t.tabs[entry]}</button>)}
        </nav>
      )}
      <main style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {active === "player" && <PlayerTab view={view} setView={setView} live={live} />}
        {active === "playlists" && <PlaylistsTab me={me} />}
        {active === "history" && <HistoryTab />}
        {active === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}
