import { useCallback, useEffect, useState } from "react";
import type { Language, PublishedMap, Viewer } from "../shared/bundle";
import type { Attempt, MapPage as MapPageData, MapSummary } from "../shared/runs";
import { fetchMap, fetchMaps, joinRun, Refused, SignedOut, signIn, startRun } from "./api";
import { MapArt } from "./art";
import { languageNames, lang, playedAt, switchLang, t } from "./i18n";
import { mapPath, navigate, runPath, usePath } from "./route";
import { RunPage } from "./RunPage";
import { Bar, MapSkeleton, MapsSkeleton } from "./skeletons";
import { Arrow, Back, Check, Chevron, Chips, initials, LeaveNote, Link, Notice, type RunLink, useFit } from "./ui";

const languages: Language[] = ["es", "en"];

function Header({ me, inRun, yourRun }: { me: Viewer | null | undefined; inRun: string | null | undefined; yourRun: RunLink | null | undefined }) {
  return (
    <header className={inRun ? "hd in-run" : inRun === null ? "hd hd-wait" : "hd"}>
      <Link to="/" className="wm">
        <i />
        <b>Zombies</b>
      </Link>
      {inRun && (
        <>
          <Link to="/" className="bk" label={t.maps}>
            <Back size={22} />
          </Link>
          <h1 className="cond ttl">{inRun}</h1>
        </>
      )}
      <span className="sp" />
      {inRun === undefined && yourRun && (
        <Link to={runPath(yourRun.id)} className="yr">
          <span className="live" />
          {t.yourRun}
          <span className="m">{yourRun.name[lang]}</span>
          <Arrow />
        </Link>
      )}
      {me !== undefined && (
        <div className="lg" role="group" aria-label={t.language}>
          {languages.map((code) => (
            <button key={code} type="button" aria-pressed={code === lang} onClick={code === lang ? undefined : switchLang}>
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      {me && (
        <span className="cs cs-me hd-me" role="img" aria-label={me.name} title={me.name}>
          {initials(me.name)}
        </span>
      )}
    </header>
  );
}

function label(map: { test: boolean; game: string }): string {
  return map.test ? t.testMap : map.game;
}

function MapRow({ map }: { map: MapSummary }) {
  const name = map.name[lang];
  return (
    <li>
      <Link to={mapPath(map.game, map.map)} className="mrow">
        <MapArt map={map} className="pl" />
        <span className="mrow-t">
          <span className="lab">{label(map)}</span>
          <h2>{name}</h2>
          <span className="sub">
            <span>
              {map.attempts === 0 ? t.noAttempts : t.attemptsLine(map.attempts, map.beaten)}
              {map.you && (
                <>
                  {" · "}
                  <span className="here">{t.youreIn}</span>
                </>
              )}
            </span>
          </span>
        </span>
        <span className="go">
          <Chevron />
        </span>
      </Link>
    </li>
  );
}

type Loaded<T> = { kind: "loading" } | { kind: "failed" } | { kind: "missing" } | { kind: "ready"; page: T };

type Heard = { onYourRun: (run: RunLink | null) => void; onViewer: (viewer: Viewer | null) => void };

function usePage<T extends { viewer: Viewer; yourRun: RunLink | null }>(fetch: () => Promise<T>, { onYourRun, onViewer }: Heard) {
  const [state, setState] = useState<Loaded<T>>({ kind: "loading" });
  const load = useCallback(() => {
    setState({ kind: "loading" });
    fetch()
      .then((page) => {
        onViewer(page.viewer);
        onYourRun(page.yourRun);
        setState({ kind: "ready", page });
      })
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        onViewer(null);
        setState({ kind: error instanceof Refused && error.status === 404 ? "missing" : "failed" });
      });
  }, [fetch, onYourRun, onViewer]);
  useEffect(load, [load]);
  return { state, load };
}

function Failed({ retry }: { retry: () => void }) {
  return (
    <Notice text={t.failed} alert>
      <button type="button" className="b b-ghost" onClick={retry}>
        {t.retry}
      </button>
    </Notice>
  );
}

function MapsPage(heard: Heard) {
  const { state, load } = usePage(fetchMaps, heard);
  const page = state.kind === "ready" ? state.page : null;

  return (
    <main className="page maps">
      <div className="maps-top">
        <h1 className="cond">{t.maps}</h1>
        <span className={page ? "lab arrive" : "lab"}>{page ? t.onFile(page.maps.length) : state.kind === "loading" ? <Bar w="7em" /> : " "}</span>
      </div>
      {state.kind === "loading" && <MapsSkeleton />}
      {state.kind === "failed" && <Failed retry={load} />}
      {page && page.maps.length === 0 && <p className="empty arrive">{t.noMaps}</p>}
      {page && page.maps.length > 0 && (
        <ul className="mlist arrive">
          {page.maps.map((map) => (
            <MapRow key={`${map.game}/${map.map}`} map={map} />
          ))}
        </ul>
      )}
    </main>
  );
}

function AttemptRow({ attempt, busy, onJoin }: { attempt: Attempt; busy: boolean; onJoin: (id: string) => void }) {
  const live = attempt.you ? " run-you" : attempt.playing ? " run-live" : "";
  const body = (
    <>
      <Chips members={attempt.members} />
      <span className="run-t">
        {(attempt.playing || attempt.beaten) && (
          <span className="marks">
            {attempt.playing && (
              <span className="live-tag">
                <i />
                {attempt.you ? t.youreInIt : t.playing}
              </span>
            )}
            {attempt.beaten && (
              <span className="won">
                <Check />
                {t.beaten}
              </span>
            )}
          </span>
        )}
        <span className="who">{t.runOf(attempt.startedBy)}</span>
        <span className="m">
          {attempt.members.length > 0 && (
            <span className="wide">
              {attempt.members.map((member) => member.name).join(", ")}
              {" · "}
            </span>
          )}
          {t.cariSpeaksIn[attempt.language]}
          {" · "}
          {playedAt(attempt.lastPlayed)}
        </span>
      </span>
    </>
  );
  if (attempt.you)
    return (
      <Link to={runPath(attempt.id)} className={`run${live}`}>
        {body}
        <span className="go go-open">{t.open}</span>
      </Link>
    );
  return (
    <button type="button" className={`run${live}`} disabled={busy} onClick={() => onJoin(attempt.id)}>
      {body}
      <span className="go">{t.join}</span>
    </button>
  );
}

function MapBanner({ map, attempts }: { map: PublishedMap; attempts: Attempt[] }) {
  const name = map.name[lang];
  const title = useFit<HTMLHeadingElement>(name);
  const beaten = attempts.filter((attempt) => attempt.beaten).length;
  return (
    <section className="banner">
      <div className="bn-id">
        <span className="lab">{label(map)}</span>
        <h1 ref={title} className="cond">
          {name}
        </h1>
        <p className="bn-cnt">
          {attempts.length === 0 ? t.noAttempts : t.attemptsLine(attempts.length, beaten)}
          {attempts.some((attempt) => attempt.you) && (
            <>
              {" · "}
              <span className="here">{t.youreIn}</span>
            </>
          )}
        </p>
      </div>
      <MapArt map={map} label={map.image ? t.artOf(name) : t.planOf(name)} className="bn-art" large />
    </section>
  );
}

function MapView({ page }: { page: MapPageData }) {
  const { map, attempts, yourRun } = page;
  const [language, setLanguage] = useState<Language>("es");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<"start" | "join" | null>(null);
  const others = attempts.some((attempt) => !attempt.you);

  const act = (kind: "start" | "join", post: () => Promise<{ id: string }>) => {
    setBusy(true);
    setFailed(null);
    post()
      .then(({ id }) => navigate(runPath(id)))
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        setBusy(false);
        setFailed(kind);
      });
  };

  return (
    <main className="page mapv arrive">
      <Link to="/" className="back">
        <Back />
        {t.maps}
      </Link>
      <MapBanner map={map} attempts={attempts} />
      <div className="below">
        <section className="sec">
          <h2>{t.attempts}</h2>
          {attempts.length === 0 ? (
            <p className="empty">{t.noneOnMap}</p>
          ) : (
            attempts.map((attempt) => <AttemptRow key={attempt.id} attempt={attempt} busy={busy} onJoin={(id) => act("join", () => joinRun(id))} />)
          )}
          {failed === "join" && (
            <p className="state" role="alert">
              {t.failed}
            </p>
          )}
        </section>
        <section className="sec">
          <h2>{t.startARun}</h2>
          <div className="card">
            <fieldset className="seg">
              <legend>{t.cariSpeaks}</legend>
              {languages.map((code) => (
                <label key={code}>
                  <input type="radio" name="lang" checked={language === code} onChange={() => setLanguage(code)} />
                  {languageNames[code]}
                </label>
              ))}
            </fieldset>
            {failed === "start" && (
              <p className="state" role="alert">
                {t.failed}
              </p>
            )}
            <button type="button" className="b b-red wide-b" disabled={busy} onClick={() => act("start", () => startRun(map.game, map.map, language))}>
              {t.startRun}
            </button>
          </div>
          {yourRun && <LeaveNote before={others ? t.leaveOnEither : t.leaveOnStart} name={yourRun.name[lang]} after={t.leaveAfter} />}
        </section>
      </div>
    </main>
  );
}

function MapPage({ game, map, ...heard }: { game: string; map: string } & Heard) {
  const fetch = useCallback(() => fetchMap(game, map), [game, map]);
  const { state, load } = usePage(fetch, heard);
  if (state.kind === "loading") return <MapSkeleton />;
  if (state.kind === "failed")
    return (
      <main className="page">
        <Failed retry={load} />
      </main>
    );
  if (state.kind === "missing")
    return (
      <main className="page">
        <Notice text={t.noSuchMap} alert>
          <Link to="/" className="b b-ghost">
            {t.maps}
          </Link>
        </Notice>
      </main>
    );
  return <MapView page={state.page} />;
}

export function App() {
  const path = usePath();
  const [me, setMe] = useState<Viewer | null | undefined>();
  const [runHead, setRunHead] = useState<{ id: string; name: string | undefined } | null>(null);
  const [yourRun, setYourRun] = useState<RunLink | null | undefined>();

  const onViewer = useCallback((viewer: Viewer | null) => setMe((current) => viewer ?? current ?? null), []);

  const runId = path.match(/^\/attempts\/([^/]+)\/?$/)?.[1];
  const mapMatch = path.match(/^\/maps\/([^/]+)\/([^/]+)\/?$/);
  const onMap = useCallback((name: string | undefined) => runId && setRunHead({ id: runId, name }), [runId]);
  const inRun = runId ? (runHead?.id === runId ? runHead.name : null) : undefined;

  return (
    <>
      <Header me={me} inRun={inRun} yourRun={yourRun} />
      {runId ? (
        <RunPage key={runId} id={decodeURIComponent(runId)} expect={yourRun === undefined || yourRun?.id === decodeURIComponent(runId) ? "run" : "join"} onMap={onMap} onYourRun={setYourRun} onViewer={onViewer} />
      ) : mapMatch ? (
        <MapPage key={path} game={decodeURIComponent(mapMatch[1]!)} map={decodeURIComponent(mapMatch[2]!)} onYourRun={setYourRun} onViewer={onViewer} />
      ) : (
        <MapsPage onYourRun={setYourRun} onViewer={onViewer} />
      )}
    </>
  );
}
