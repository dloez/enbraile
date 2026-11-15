import { useCallback, useEffect, useState } from "react";
import type { PublishedMap } from "../shared/bundle";
import { fetchMaps, fetchMe, SignedOut, signIn, type Me } from "./api";
import { MapArt } from "./art";
import { lang, switchLang, t } from "./i18n";

const PEOPLE = 5;

function personColour(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `var(--person-${(hash % PEOPLE) + 1})`;
}

function Drips() {
  return (
    <svg className="drips" viewBox="0 0 1440 22" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 0h1440v2H0z M212 2c0 0 3 0 3 6s-3 9-3 9-3-3-3-9 3-6 3-6z M640 2c0 0 2 0 2 4s-2 6-2 6-2-2-2-6 2-4 2-4z M1012 2c0 0 3.5 0 3.5 8s-3.5 11-3.5 11-3.5-3-3.5-11 3.5-8 3.5-8z M1290 2c0 0 2 0 2 3.5s-2 5-2 5-2-1.5-2-5 2-3.5 2-3.5z" />
    </svg>
  );
}

function Header({ me }: { me: Me | null }) {
  return (
    <header className="hdr">
      <a href="/" className="mark">
        <b>zombies</b>
        <i>.enbraile.vip</i>
      </a>
      <span className="spacer" />
      <button type="button" className="lang" aria-label={t.language} onClick={switchLang}>
        {lang.toUpperCase()}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {me && (
        <span className="me" style={{ ["--person" as string]: personColour(me.user.discordId) }} title={me.user.name}>
          {me.user.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <Drips />
    </header>
  );
}

function MapCard({ map }: { map: PublishedMap }) {
  const key = `${map.game}-${map.map}`;
  return (
    <article className="card">
      <div className="art">
        <MapArt art={map.art} id={key} />
        {map.test && <span className="chip tag">{t.testMap}</span>}
        <h2 className="stencil">{map.name[lang]}</h2>
      </div>
      <div className="card-body">
        <span className="label">{t.runs}</span>
        <div className="empty">{t.noRuns}</div>
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
      <main className="page">
        <h1 className="stencil">{t.maps}</h1>
        {state.kind === "failed" && (
          <div className="notice">
            {t.failed}
            <button type="button" className="btn btn-quiet" onClick={load}>
              {t.retry}
            </button>
          </div>
        )}
        {state.kind === "ready" && state.maps.length === 0 && <div className="notice">{t.noMaps}</div>}
        {state.kind === "ready" && state.maps.length > 0 && (
          <div className="grid">
            {state.maps.map((map) => (
              <MapCard key={`${map.game}/${map.map}`} map={map} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
