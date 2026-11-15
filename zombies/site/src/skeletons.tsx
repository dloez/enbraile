import type { ReactNode } from "react";

export function Bar({ w }: { w: string }) {
  return <span className="skeleton sk-line" style={{ width: w }} />;
}

function Chip() {
  return <span className="cs skeleton" />;
}

function Plan({ className }: { className: string }) {
  return (
    <span className={`${className} skeleton`}>
      <span className="sk-plan" />
    </span>
  );
}

function Member({ w }: { w: string }) {
  return (
    <li>
      <Chip />
      <Bar w={w} />
    </li>
  );
}

function Shell({ className, children }: { className: string; children: ReactNode }) {
  return (
    <main className={`${className} sk`} aria-busy="true">
      {children}
    </main>
  );
}

const mapRows = ["62%", "48%", "56%"];

export function MapsSkeleton() {
  return (
    <ul className="mlist sk" aria-hidden="true">
      {mapRows.map((width, index) => (
        <li key={index}>
          <div className="mrow">
            <Plan className="pl" />
            <span className="mrow-t">
              <span className="lab">
                <Bar w="7em" />
              </span>
              <h2>
                <Bar w={width} />
              </h2>
              <span className="sub">
                <Bar w="9em" />
              </span>
            </span>
            <span className="go" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MapHeadSkeleton() {
  return (
    <div className="mv-head" aria-hidden="true">
      <span className="back">
        <Bar w="4em" />
      </span>
      <div className="mv-title">
        <div className="mv-name">
          <span className="lab">
            <Bar w="8em" />
          </span>
          <h1 className="cond">
            <Bar w="92%" /> <Bar w="58%" />
          </h1>
        </div>
        <Plan className="pl mv-small" />
      </div>
      <Plan className="plan mv-large" />
    </div>
  );
}

function RunRowSkeleton({ w }: { w: string }) {
  return (
    <div className="run">
      <span className="chips">
        <Chip />
        <Chip />
      </span>
      <span className="run-t">
        <span className="who">
          <Bar w={w} />
        </span>
        <span className="m">
          <Bar w="10em" />
        </span>
      </span>
      <span className="skeleton sk-go" />
    </div>
  );
}

export function MapSkeleton() {
  return (
    <Shell className="page two">
      <MapHeadSkeleton />
      <div className="side" aria-hidden="true">
        <section className="sec">
          <h2>
            <Bar w="7em" />
          </h2>
          <RunRowSkeleton w="9em" />
        </section>
        <section className="sec">
          <h2>
            <Bar w="6em" />
          </h2>
          <div className="card">
            <div className="sk-stack">
              <span className="lab">
                <Bar w="6em" />
              </span>
              <span className="seg">
                <span className="skeleton sk-option" />
                <span className="skeleton sk-option" />
              </span>
            </div>
            <span className="b wide-b skeleton" />
          </div>
        </section>
      </div>
    </Shell>
  );
}

export function JoinSkeleton() {
  return (
    <Shell className="page two join">
      <MapHeadSkeleton />
      <div className="side" aria-hidden="true">
        <div className="card join-card">
          <div className="join-grid">
            <div>
              <span className="lab">
                <Bar w="6em" />
              </span>
              <ul className="mem">
                <Member w="6em" />
                <Member w="8em" />
              </ul>
            </div>
            <div>
              <span className="lab">
                <Bar w="6em" />
              </span>
              <p className="val">
                <Bar w="5em" />
              </p>
            </div>
          </div>
          <span className="b wide-b skeleton" />
        </div>
        <span className="link">
          <Bar w="12em" />
        </span>
      </div>
    </Shell>
  );
}

const lines = [
  { who: "5em", msg: ["58%"] },
  { who: "3em", msg: ["92%", "64%"] },
  { who: "6em", msg: ["40%"] },
];

export function RowsSkeleton() {
  return lines.map((line, index) => (
    <div key={index} className="row sk" aria-hidden="true">
      <span className="t">
        <Bar w="3em" />
      </span>
      <div>
        <p className="who">
          <Bar w={line.who} />
        </p>
        <p className="msg">
          {line.msg.map((width, at) => (
            <Bar key={at} w={width} />
          ))}
        </p>
      </div>
    </div>
  ));
}

export function RunSkeleton() {
  return (
    <div className="runv sk" aria-busy="true">
      <aside className="rail" aria-hidden="true">
        <div>
          <span className="lab">
            <Bar w="5em" />
          </span>
          <h2 className="cond">
            <Bar w="88%" /> <Bar w="50%" />
          </h2>
          <p className="sub">
            <Bar w="9em" />
          </p>
        </div>
        <div>
          <span className="lab">
            <Bar w="6em" />
          </span>
          <ul className="mem">
            <Member w="7em" />
            <Member w="5em" />
          </ul>
          <span className="b copy skeleton" />
        </div>
      </aside>
      <div className="strip" aria-hidden="true">
        <span className="chips">
          <Chip />
          <Chip />
        </span>
        <span className="m">
          <Bar w="9em" />
        </span>
        <span className="sp" />
        <span className="ib skeleton" />
      </div>
      <section className="main" aria-hidden="true">
        <div className="rows">
          <RowsSkeleton />
        </div>
        <div className="cmp">
          <div className="cmp-in">
            <span className="field skeleton" />
            <span className="revb skeleton sk-revb" />
            <span className="b skeleton sk-send" />
          </div>
        </div>
      </section>
    </div>
  );
}
