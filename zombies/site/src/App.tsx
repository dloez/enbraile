import { useCallback, useEffect, useState } from "react";
import type { Language } from "../shared/bundle";
import type { MapsPage as Page, MapWithRuns, OpenRun, YourRun } from "../shared/runs";
import { fetchMaps, fetchMe, SignedOut, signIn, startRun, type Me } from "./api";
import { MapPlan } from "./art";
import { languageNames, lang, switchLang, t } from "./i18n";
import { navigate, runPath, usePath } from "./route";
import { RunPage } from "./RunPage";
import { Arrow, Back, Chips, Close, LeaveNote, Link } from "./ui";

const languages: Language[] = ["es", "en"];

export function Header({ me, inRun }: { me: Me | null; inRun?: string }) {
  return (
    <header className={inRun ? "hd in-run" : "hd"}>
      <Link to="/" className="wm">
        <i />
        <b>Zombies</b>
      </Link>
      {inRun && (
        <>
          <Link to="/" className="bk" label={t.maps}>
            <Back />
          </Link>
          <span className="ttl">{inRun}</span>
        </>
      )}
      <span className="tag">{t.radioLog} · enbraile.vip</span>
      <span className="sp" />
      <div className="lg" role="group" aria-label={t.language}>
        {languages.map((code) => (
          <button key={code} type="button" aria-pressed={code === lang} onClick={code === lang ? undefined : switchLang}>
            {code.toUpperCase()}
          </button>
        ))}
      </div>
      {me && (
        <span className="me">
          <span title={me.user.name}>{me.user.name.toUpperCase()}</span>
        </span>
      )}
    </header>
  );
}

function RunRow({ run }: { run: OpenRun }) {
  return (
    <div className="rl">
      <Chips members={run.members} />
      <span className="nm">{run.startedBy}</span>
      <span className="cs">{run.language.toUpperCase()}</span>
      {run.you ? (
        <Link to={runPath(run.id)} className="here">
          {t.youreIn}
        </Link>
      ) : (
        <Link to={runPath(run.id)} className="b b-line">
          {t.join}
        </Link>
      )}
    </div>
  );
}

function MapRow({ map, onStart }: { map: MapWithRuns; onStart: () => void }) {
  const name = map.name[lang];
  return (
    <article className="mr">
      <div className="pl">
        <MapPlan art={map.art} name={name} />
      </div>
      <div className="mn">
        <span className="lab">{map.test ? t.testMap : map.game}</span>
        <h2 className="cond">{name}</h2>
      </div>
      <div className="runs">
        {map.runs.length === 0 ? <p className="none">{t.noneOpen}</p> : map.runs.map((run) => <RunRow key={run.id} run={run} />)}
        <div className="act">
          <button type="button" className="b b-line" onClick={onStart}>
            {t.startRun} <Arrow />
          </button>
        </div>
      </div>
    </article>
  );
}

function YourRunPanel({ run }: { run: YourRun }) {
  return (
    <div className="yr">
      <span className="lab">{t.yourRun}</span>
      <h2 className="cond">{run.name[lang]}</h2>
      <div className="yr-m">
        <Chips members={run.members} />
        <span className="lab">{t.lang(run.language.toUpperCase())}</span>
      </div>
      <Link to={runPath(run.id)} className="b yr-go">
        {t.backToRun} <Arrow />
      </Link>
    </div>
  );
}

function YourRunBand({ run }: { run: YourRun }) {
  return (
    <Link to={runPath(run.id)} className="yr-band">
      <span>
        <span className="lab">
          {t.yourRun} · {run.language.toUpperCase()}
        </span>
        <span className="cond">{run.name[lang]}</span>
      </span>
      <Arrow />
    </Link>
  );
}

function StartSheet({ map, yourRun, onClose }: { map: MapWithRuns; yourRun: YourRun | null; onClose: () => void }) {
  const [language, setLanguage] = useState<Language>("es");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = map.name[lang];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const start = () => {
    setBusy(true);
    setFailed(false);
    startRun(map.game, map.map, language)
      .then(({ id }) => navigate(runPath(id)))
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        setBusy(false);
        setFailed(true);
      });
  };

  return (
    <>
      <div className="scrim" aria-hidden="true" onClick={onClose} />
      <aside className="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="nt">
        <div className="sheet-top">
          <span className="lab">{t.newRun}</span>
          <button type="button" className="x" aria-label={t.close} onClick={onClose}>
            <Close />
          </button>
        </div>
        <h2 id="nt" className="cond">
          {name}
        </h2>
        <div className="sheet-map">
          <span className="lab">{map.test ? t.testMap : map.game}</span>
          <MapPlan art={map.art} name={name} />
        </div>
        <fieldset className="langs">
          <legend className="lab">{t.cariSpeaks}</legend>
          {languages.map((code) => (
            <label key={code} className="opt">
              <input type="radio" name="lang" checked={language === code} onChange={() => setLanguage(code)} />
              <span className="code">{code.toUpperCase()}</span>
              <span>{languageNames[code]}</span>
            </label>
          ))}
        </fieldset>
        {yourRun && <LeaveNote name={yourRun.name[lang]} />}
        {failed && <p className="none">{t.failed}</p>}
        <div className="sheet-actions">
          <button type="button" className="b b-line" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="button" className="b b-red" disabled={busy} onClick={start}>
            {t.startRun} <Arrow />
          </button>
        </div>
      </aside>
    </>
  );
}

type State = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; page: Page };

function MapsPage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [starting, setStarting] = useState<MapWithRuns | null>(null);

  const load = useCallback(() => {
    setState({ kind: "loading" });
    fetchMaps()
      .then((page) => setState({ kind: "ready", page }))
      .catch((error: unknown) => (error instanceof SignedOut ? signIn() : setState({ kind: "failed" })));
  }, []);

  useEffect(load, [load]);

  const close = useCallback(() => setStarting(null), []);
  const page = state.kind === "ready" ? state.page : null;

  return (
    <div className="maps">
      <aside className="maps-head">
        <div className="maps-title">
          {page && <span className="lab">{t.onFile(page.maps.length)}</span>}
          <h1 className="cond">{t.maps}</h1>
        </div>
        {page?.yourRun && <YourRunPanel run={page.yourRun} />}
      </aside>
      <main className="maps-list">
        {page?.yourRun && <YourRunBand run={page.yourRun} />}
        {state.kind === "failed" && (
          <div className="notice">
            <p className="none">{t.failed}</p>
            <button type="button" className="b b-line" onClick={load}>
              {t.retry}
            </button>
          </div>
        )}
        {page && page.maps.length === 0 && (
          <div className="notice">
            <p className="none">{t.noMaps}</p>
          </div>
        )}
        {page && page.maps.length > 0 && (
          <>
            <div className="colh">
              <span className="lab">{t.plan}</span>
              <span className="lab">{t.map}</span>
              <span className="lab">{t.openRuns}</span>
            </div>
            {page.maps.map((map) => (
              <MapRow key={`${map.game}/${map.map}`} map={map} onStart={() => setStarting(map)} />
            ))}
            <div className="eof">
              <span className="lab">{t.endOfFile}</span>
              <span className="lab">enbraile.vip</span>
            </div>
          </>
        )}
      </main>
      {starting && page && <StartSheet map={starting} yourRun={page.yourRun} onClose={close} />}
    </div>
  );
}

export function App() {
  const path = usePath();
  const [me, setMe] = useState<Me | null>(null);
  const [inRun, setInRun] = useState<string | undefined>();

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch((error: unknown) => error instanceof SignedOut && signIn());
  }, []);

  const runId = path.match(/^\/runs\/([^/]+)\/?$/)?.[1];

  useEffect(() => {
    if (!runId) setInRun(undefined);
  }, [runId]);

  return (
    <>
      <Header me={me} inRun={runId ? inRun : undefined} />
      {runId ? <RunPage key={runId} id={decodeURIComponent(runId)} onMap={setInRun} /> : <MapsPage />}
    </>
  );
}
