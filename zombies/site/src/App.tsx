import { useCallback, useEffect, useState } from "react";
import type { Language, PublishedMap } from "../shared/bundle";
import { fetchMaps, fetchMe, SignedOut, signIn, type Me } from "./api";
import { MapPlan } from "./art";
import { lang, switchLang, t } from "./i18n";

const languages: Language[] = ["es", "en"];

function Header({ me }: { me: Me | null }) {
  return (
    <header className="hd">
      <a href="/" className="wm">
        <i />
        <b>Zombies</b>
      </a>
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

function MapRow({ map }: { map: PublishedMap }) {
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
        <p className="none">{t.noneOpen}</p>
      </div>
    </article>
  );
}

type State = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; me: Me; maps: PublishedMap[] };

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(() => {
    setState({ kind: "loading" });
    Promise.all([fetchMe(), fetchMaps()])
      .then(([me, maps]) => setState({ kind: "ready", me, maps }))
      .catch((error: unknown) => (error instanceof SignedOut ? signIn() : setState({ kind: "failed" })));
  }, []);

  useEffect(load, [load]);

  return (
    <>
      <Header me={state.kind === "ready" ? state.me : null} />
      <div className="maps">
        <aside className="maps-head">
          {state.kind === "ready" && <span className="lab">{t.onFile(state.maps.length)}</span>}
          <h1 className="cond">{t.maps}</h1>
        </aside>
        <main className="maps-list">
          {state.kind === "failed" && (
            <div className="notice">
              <p className="none">{t.failed}</p>
              <button type="button" className="b b-line" onClick={load}>
                {t.retry}
              </button>
            </div>
          )}
          {state.kind === "ready" && state.maps.length === 0 && (
            <div className="notice">
              <p className="none">{t.noMaps}</p>
            </div>
          )}
          {state.kind === "ready" && state.maps.length > 0 && (
            <>
              <div className="colh">
                <span className="lab">{t.plan}</span>
                <span className="lab">{t.map}</span>
                <span className="lab">{t.openRuns}</span>
              </div>
              {state.maps.map((map) => (
                <MapRow key={`${map.game}/${map.map}`} map={map} />
              ))}
              <div className="eof">
                <span className="lab">{t.endOfFile}</span>
                <span className="lab">enbraile.vip</span>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
