import { useCallback, useEffect, useState } from "react";
import type { Language } from "../shared/bundle";
import type { MapsPage as Page, MapWithRuns, OpenRun } from "../shared/runs";
import { fetchMaps, fetchMe, joinRun, SignedOut, signIn, startRun, type Me } from "./api";
import { MapPlan } from "./art";
import { languageNames, lang, switchLang, t } from "./i18n";
import { mapPath, navigate, runPath, usePath } from "./route";
import { RunPage } from "./RunPage";
import { Arrow, Back, Chevron, Chips, initials, LeaveNote, Link, MapHead, Notice, type RunLink } from "./ui";

const languages: Language[] = ["es", "en"];

function Header({ me, inRun, yourRun }: { me: Me | null | undefined; inRun: string | null | undefined; yourRun: RunLink | null | undefined }) {
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
        <span className="cs cs-me hd-me" role="img" aria-label={me.user.name} title={me.user.name}>
          {initials(me.user.name)}
        </span>
      )}
    </header>
  );
}

function label(map: MapWithRuns): string {
  return map.test ? t.testMap : map.game;
}

function RowRuns({ runs }: { runs: OpenRun[] }) {
  const mine = runs.some((run) => run.you);
  if (runs.length === 0) return <span>{t.noOpenRuns}</span>;
  if (runs.length > 1)
    return (
      <span>
        {t.someOpenRuns(runs.length)}
        {mine && (
          <>
            {" · "}
            <span className="here">{t.youreIn}</span>
          </>
        )}
      </span>
    );
  const run = runs[0]!;
  return (
    <>
      <Chips members={run.members} />
      <span>
        <span className={run.you ? "wide" : undefined}>{t.runOf(run.startedBy)}</span>
        {run.you ? (
          <>
            <span className="wide">{" · "}</span>
            <span className="here">
              <span className="wide">{t.youreIn}</span>
              <span className="narrow">{t.youreInIt}</span>
            </span>
          </>
        ) : (
          <span className="wide">
            {" · "}
            {languageNames[run.language]}
          </span>
        )}
      </span>
    </>
  );
}

function MapRow({ map }: { map: MapWithRuns }) {
  const name = map.name[lang];
  return (
    <li>
      <Link to={mapPath(map.game, map.map)} className="mrow">
        <span className="pl">
          <MapPlan art={map.art} />
        </span>
        <span className="mrow-t">
          <span className="lab">{label(map)}</span>
          <h2>{name}</h2>
          <span className="sub">
            <RowRuns runs={map.runs} />
          </span>
        </span>
        <span className="go">
          <Chevron />
        </span>
      </Link>
    </li>
  );
}

type Loaded = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; page: Page };

function useMaps(onYourRun: (run: RunLink | null) => void) {
  const [state, setState] = useState<Loaded>({ kind: "loading" });
  const load = useCallback(() => {
    setState({ kind: "loading" });
    fetchMaps()
      .then((page) => {
        onYourRun(page.yourRun);
        setState({ kind: "ready", page });
      })
      .catch((error: unknown) => (error instanceof SignedOut ? signIn() : setState({ kind: "failed" })));
  }, [onYourRun]);
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

function MapsPage({ onYourRun }: { onYourRun: (run: RunLink | null) => void }) {
  const { state, load } = useMaps(onYourRun);
  const page = state.kind === "ready" ? state.page : null;

  return (
    <main className="page maps">
      <div className="maps-top">
        <h1 className="cond">{t.maps}</h1>
        <span className="lab">{page ? t.onFile(page.maps.length) : " "}</span>
      </div>
      {state.kind === "loading" && <Notice text={t.receiving} />}
      {state.kind === "failed" && <Failed retry={load} />}
      {page && page.maps.length === 0 && <p className="empty">{t.noMaps}</p>}
      {page && page.maps.length > 0 && (
        <ul className="mlist">
          {page.maps.map((map) => (
            <MapRow key={`${map.game}/${map.map}`} map={map} />
          ))}
        </ul>
      )}
    </main>
  );
}

function OpenRunRow({ run, busy, onJoin }: { run: OpenRun; busy: boolean; onJoin: (id: string) => void }) {
  const body = (
    <>
      <Chips members={run.members} />
      <span className="run-t">
        <span className="who">{t.runOf(run.startedBy)}</span>
        <span className="m">
          {run.members.length > 0 && (
            <span className="wide">
              {run.members.map((member) => member.name).join(", ")}
              {" · "}
            </span>
          )}
          {t.cariSpeaksIn[run.language]}
        </span>
      </span>
    </>
  );
  if (run.you)
    return (
      <Link to={runPath(run.id)} className="run">
        {body}
        <span className="here go-here">{t.youreInIt}</span>
      </Link>
    );
  return (
    <button type="button" className="run" disabled={busy} onClick={() => onJoin(run.id)}>
      {body}
      <span className="go">{t.join}</span>
    </button>
  );
}

function MapView({ map, yourRun }: { map: MapWithRuns; yourRun: RunLink | null }) {
  const [language, setLanguage] = useState<Language>("es");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<"start" | "join" | null>(null);
  const name = map.name[lang];
  const others = map.runs.some((run) => !run.you);

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
    <main className="page two">
      <MapHead back eyebrow={label(map)} name={name} art={map.art} plan={t.planOf(name)} />
      <div className="side">
        <section className="sec">
          <h2>{t.openRuns}</h2>
          {map.runs.length === 0 ? (
            <p className="empty">{t.noneOnMap}</p>
          ) : (
            map.runs.map((run) => <OpenRunRow key={run.id} run={run} busy={busy} onJoin={(id) => act("join", () => joinRun(id))} />)
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

function MapPage({ game, map, onYourRun }: { game: string; map: string; onYourRun: (run: RunLink | null) => void }) {
  const { state, load } = useMaps(onYourRun);
  if (state.kind === "loading")
    return (
      <main className="page">
        <Notice text={t.receiving} />
      </main>
    );
  if (state.kind === "failed")
    return (
      <main className="page">
        <Failed retry={load} />
      </main>
    );
  const found = state.page.maps.find((each) => each.game === game && each.map === map);
  if (!found)
    return (
      <main className="page">
        <Notice text={t.noSuchMap} alert>
          <Link to="/" className="b b-ghost">
            {t.maps}
          </Link>
        </Notice>
      </main>
    );
  return <MapView map={found} yourRun={state.page.yourRun} />;
}

export function App() {
  const path = usePath();
  const [me, setMe] = useState<Me | null | undefined>();
  const [runHead, setRunHead] = useState<{ id: string; name: string | undefined } | null>(null);
  const [yourRun, setYourRun] = useState<RunLink | null | undefined>();

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch((error: unknown) => (error instanceof SignedOut ? signIn() : setMe(null)));
  }, []);

  const runId = path.match(/^\/runs\/([^/]+)\/?$/)?.[1];
  const mapMatch = path.match(/^\/maps\/([^/]+)\/([^/]+)\/?$/);
  const onMap = useCallback((name: string | undefined) => runId && setRunHead({ id: runId, name }), [runId]);
  const inRun = runId ? (runHead?.id === runId ? runHead.name : null) : undefined;

  return (
    <>
      <Header me={me} inRun={inRun} yourRun={yourRun} />
      {runId ? (
        <RunPage key={runId} id={decodeURIComponent(runId)} onMap={onMap} onYourRun={setYourRun} />
      ) : mapMatch ? (
        <MapPage key={path} game={decodeURIComponent(mapMatch[1]!)} map={decodeURIComponent(mapMatch[2]!)} onYourRun={setYourRun} />
      ) : (
        <MapsPage onYourRun={setYourRun} />
      )}
    </>
  );
}
