import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Language, PublishedMap, Viewer } from "../shared/bundle";
import type { Attempt, MapPage as MapPageData, MapSummary } from "../shared/runs";
import { characterOf, defaultVoice, voiceNames, voices, type Voice } from "../shared/voices";
import { joinRun, Refused, SignedOut, signIn, startRun } from "./api";
import { MapArt } from "./art";
import { languageNames, lang, playedAt, switchLang, t } from "./i18n";
import { mapPath, navigate, place, runPath, usePath } from "./route";
import { RunPage } from "./RunPage";
import { Bar, MapBelowSkeleton, MapSkeleton, MapsSkeleton } from "./skeletons";
import { forget, known, load as fetchPage, mapSource, mapsSource, openFreshMs, runSource, nameOf, type Source } from "./store";
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

function usePage<T extends { viewer: Viewer; yourRun: RunLink | null }>(source: Source<T>, { onYourRun, onViewer }: Heard) {
  const [atOnce] = useState(() => known(source) !== undefined);
  const [state, setState] = useState<Loaded<T>>(() => {
    const page = known(source);
    return page ? { kind: "ready", page } : { kind: "loading" };
  });
  const asked = useRef(0);
  const load = useCallback(
    (freshMs: number) => {
      const ask = ++asked.current;
      setState((current) => (current.kind === "ready" ? current : { kind: "loading" }));
      fetchPage(source, freshMs)
        .then((page) => {
          if (ask !== asked.current) return;
          onViewer(page.viewer);
          onYourRun(page.yourRun);
          setState({ kind: "ready", page });
        })
        .catch((error: unknown) => {
          if (error instanceof SignedOut) return signIn();
          if (ask !== asked.current) return;
          onViewer(null);
          if (error instanceof Refused && error.status === 404) {
            forget(source);
            setState({ kind: "missing" });
          } else setState((current) => (current.kind === "ready" ? current : { kind: "failed" }));
        });
    },
    [source, onYourRun, onViewer],
  );
  useEffect(() => load(openFreshMs), [load]);
  const retry = useCallback(() => load(0), [load]);
  return { state, load: retry, atOnce };
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

let mapsScroll = 0;

function MapsPage(heard: Heard) {
  const { state, load, atOnce } = usePage(mapsSource, heard);
  const page = state.kind === "ready" ? state.page : null;
  const arrive = atOnce ? "" : " arrive";
  const scroller = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (atOnce && scroller.current) scroller.current.scrollTop = mapsScroll;
    else mapsScroll = 0;
  }, [atOnce]);

  return (
    <main className="page maps" ref={scroller} onScroll={(event) => (mapsScroll = event.currentTarget.scrollTop)}>
      <div className="maps-top">
        <h1 className="cond">{t.maps}</h1>
        <span className={page ? `lab${arrive}` : "lab"}>{page ? t.onFile(page.maps.length) : state.kind === "loading" ? <Bar w="7em" /> : " "}</span>
      </div>
      {state.kind === "loading" && <MapsSkeleton />}
      {state.kind === "failed" && <Failed retry={load} />}
      {page && page.maps.length === 0 && <p className={`empty${arrive}`}>{t.noMaps}</p>}
      {page && page.maps.length > 0 && (
        <ul className={`mlist${arrive}`}>
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
        <span className="who">{t.runOf(nameOf(attempt.startedBy))}</span>
        <span className="m">
          {attempt.members.length > 0 && (
            <span className="wide">
              {attempt.members.map(nameOf).join(", ")}
              {" · "}
            </span>
          )}
          {t.speaksIn(characterOf(attempt.voice).name, attempt.language)}
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

type Counts = { attempts: number; beaten: number; you: boolean };

function counted(attempts: Attempt[]): Counts {
  return { attempts: attempts.length, beaten: attempts.filter((attempt) => attempt.beaten).length, you: attempts.some((attempt) => attempt.you) };
}

function MapBanner({ map, counts }: { map: PublishedMap; counts: Counts }) {
  const name = map.name[lang];
  const title = useFit<HTMLHeadingElement>(name);
  return (
    <section className="banner">
      <div className="bn-id">
        <span className="lab">{label(map)}</span>
        <h1 ref={title} className="cond">
          {name}
        </h1>
        <p className="bn-cnt">
          {counts.attempts === 0 ? t.noAttempts : t.attemptsLine(counts.attempts, counts.beaten)}
          {counts.you && (
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

function MapBelow({ page, arrive }: { page: MapPageData; arrive: boolean }) {
  const { map, attempts, yourRun } = page;
  const [language, setLanguage] = useState<Language>("es");
  const [voice, setVoice] = useState<Voice>(defaultVoice);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<"start" | "join" | null>(null);
  const others = attempts.some((attempt) => !attempt.you);

  const act = (kind: "start" | "join", post: () => Promise<{ id: string }>) => {
    setBusy(true);
    setFailed(null);
    post()
      .then(({ id }) => {
        forget(runSource(id));
        navigate(runPath(id));
      })
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        setBusy(false);
        setFailed(kind);
      });
  };

  return (
    <div className={arrive ? "below arrive" : "below"}>
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
            <legend>{t.voice}</legend>
            {voices.map((code) => (
              <label key={code}>
                <input type="radio" name="voice" checked={voice === code} onChange={() => setVoice(code)} />
                {voiceNames[code][lang]}
              </label>
            ))}
          </fieldset>
          <fieldset className="seg">
            <legend>{t.speaks(characterOf(voice).name)}</legend>
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
          <button type="button" className="b b-red wide-b" disabled={busy} onClick={() => act("start", () => startRun(map.game, map.map, language, voice))}>
            {t.startRun}
          </button>
        </div>
        {yourRun && <LeaveNote before={others ? t.leaveOnEither : t.leaveOnStart} name={yourRun.name[lang]} after={t.leaveAfter} />}
      </section>
    </div>
  );
}

function MapView({ map, counts, page, arrive }: { map: PublishedMap; counts: Counts; page: MapPageData | null; arrive: "all" | "below" | "none" }) {
  return (
    <main className={arrive === "all" ? "page mapv arrive" : "page mapv"} aria-busy={page ? undefined : true}>
      <Link to="/" className="back">
        <Back />
        {t.maps}
      </Link>
      <MapBanner map={map} counts={counts} />
      {page ? <MapBelow page={page} arrive={arrive === "below"} /> : <MapBelowSkeleton />}
    </main>
  );
}

function MapPage({ game, map, ...heard }: { game: string; map: string } & Heard) {
  const source = useMemo(() => mapSource(game, map), [game, map]);
  const { state, load, atOnce } = usePage(source, heard);
  const [seed] = useState(() => (atOnce ? undefined : known(mapsSource)?.maps.find((summary) => summary.game === game && summary.map === map)));
  if (state.kind === "loading") return seed ? <MapView map={seed} counts={seed} page={null} arrive="none" /> : <MapSkeleton />;
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
  return <MapView map={state.page.map} counts={counted(state.page.attempts)} page={state.page} arrive={atOnce ? "none" : seed ? "below" : "all"} />;
}

function runName(id: string, yourRun: RunLink | null | undefined): string | undefined | null {
  const sheet = known(runSource(id));
  if (sheet) return sheet.you ? sheet.map.name[lang] : undefined;
  return yourRun?.id === id ? yourRun.name[lang] : null;
}

export function App() {
  const path = usePath();
  const [me, setMe] = useState<Viewer | null | undefined>();
  const [runHead, setRunHead] = useState<{ id: string; name: string | undefined } | null>(null);
  const [yourRun, setYourRun] = useState<RunLink | null | undefined>();

  const onViewer = useCallback((viewer: Viewer | null) => setMe((current) => viewer ?? current ?? null), []);

  const at = place(path);
  const runId = at.kind === "run" ? at.id : undefined;
  const onMap = useCallback((name: string | undefined) => runId && setRunHead({ id: runId, name }), [runId]);
  const inRun = runId ? (runHead?.id === runId ? runHead.name : runName(runId, yourRun)) : undefined;

  return (
    <>
      <Header me={me} inRun={inRun} yourRun={yourRun} />
      {at.kind === "run" ? (
        <RunPage key={at.id} id={at.id} expect={yourRun === undefined || yourRun?.id === at.id ? "run" : "join"} onMap={onMap} onYourRun={setYourRun} onViewer={onViewer} />
      ) : at.kind === "map" ? (
        <MapPage key={path} game={at.game} map={at.map} onYourRun={setYourRun} onViewer={onViewer} />
      ) : (
        <MapsPage onYourRun={setYourRun} onViewer={onViewer} />
      )}
    </>
  );
}
