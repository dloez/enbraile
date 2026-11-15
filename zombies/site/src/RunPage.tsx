import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import type { Member, Message, RunSheet } from "../shared/runs";
import { fetchRun, fetchTranscript, joinRun, Refused, sendMessage, SignedOut, signIn } from "./api";
import { MapPlan } from "./art";
import { languageNames, lang, t } from "./i18n";
import { Arrow, Chips, initials, LeaveNote, Link } from "./ui";

const pollMs = 2000;
const freshRows = 4;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function clock(at: string, seconds: boolean): string {
  const date = new Date(at);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return seconds ? `${time}:${pad(date.getSeconds())}` : time;
}

function today(): string {
  const date = new Date();
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
}

function JoinView({ sheet, onJoined }: { sheet: RunSheet; onJoined: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = sheet.map.name[lang];
  const label = sheet.map.test ? t.testMap : sheet.map.game;

  const join = () => {
    setBusy(true);
    setFailed(false);
    joinRun(sheet.id)
      .then(onJoined)
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        setBusy(false);
        setFailed(true);
      });
  };

  return (
    <div className="join">
      <main className="join-main">
        <div className="join-top">
          <span className="lab">{t.joinThisRun}</span>
          <span className="lab">{label}</span>
        </div>
        <h1 className="cond">{name}</h1>
        <div className="sheet join-plan">
          <MapPlan art={sheet.map.art} name={name} grid />
        </div>
      </main>
      <aside className="join-sheet">
        <span className="lab join-sheet-lab">{t.runSheet}</span>
        <dl className="dl">
          <dt className="lab">{t.startedBy}</dt>
          <dd>
            <span className="cs">{initials(sheet.startedBy)}</span> {sheet.startedBy}
          </dd>
          <dt className="lab">{t.inTheRun}</dt>
          <dd>
            <Chips members={sheet.members} /> {sheet.members.map((member) => member.name).join(", ")}
          </dd>
          <dt className="lab">{t.cariSpeaks}</dt>
          <dd>
            <span className="cs">{sheet.language.toUpperCase()}</span> {languageNames[sheet.language]}
          </dd>
        </dl>
        {sheet.yourRun && <LeaveNote name={sheet.yourRun.name[lang]} />}
        {failed && <p className="none">{t.failed}</p>}
        <div className="join-actions">
          <button type="button" className="b b-red" disabled={busy} onClick={join}>
            {t.joinTheRun} <Arrow />
          </button>
          <Link to="/" className="b b-line">
            {t.cancel}
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Row({ message, old }: { message: Message; old: boolean }) {
  const who = message.author === "cari" ? "who who-cari" : "who";
  return (
    <div className={old ? "row old" : "row"}>
      <span className="t">
        <span className="t-long">{clock(message.at, true)}</span>
        <span className="t-short">{clock(message.at, false)}</span>
      </span>
      <span className={who}>{message.author === "cari" ? "Cari" : message.name}</span>
      <div className="msg">
        <p className="txt">{message.text}</p>
      </div>
    </div>
  );
}

function RunView({ sheet }: { sheet: RunSheet }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>(sheet.members);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const last = useRef(0);
  const rows = useRef<HTMLDivElement>(null);
  const name = sheet.map.name[lang];

  const poll = useCallback(async () => {
    try {
      const reply = await fetchTranscript(sheet.id, last.current);
      setMembers(reply.members);
      const fresh = reply.messages.filter((message) => message.id > last.current);
      if (fresh.length) {
        last.current = fresh[fresh.length - 1]!.id;
        setMessages((current) => [...current, ...fresh]);
      }
    } catch (error) {
      if (error instanceof SignedOut) signIn();
      else if (error instanceof Refused && error.status === 403) location.reload();
    }
  }, [sheet.id]);

  useEffect(() => {
    void poll();
    const timer = setInterval(() => document.hidden || void poll(), pollMs);
    return () => clearInterval(timer);
  }, [poll]);

  useLayoutEffect(() => {
    const element = rows.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length]);

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    sendMessage(sheet.id, text)
      .then(() => {
        setDraft("");
        return poll();
      })
      .catch((error: unknown) => error instanceof SignedOut && signIn())
      .finally(() => setSending(false));
  };

  const code = sheet.language.toUpperCase();

  return (
    <div className="run">
      <aside className="rail">
        <span className="lab">{t.runLang(code)}</span>
        <h2 className="cond">{name}</h2>
        <span className="lab rail-lab">{t.inTheRun}</span>
        <ul className="mem">
          {members.map((member, index) => (
            <li key={index}>
              <span className={member.you ? "cs cs-me" : "cs"}>{initials(member.name)}</span>
              <span>{member.you ? `${member.name} · ${t.you}` : member.name}</span>
            </li>
          ))}
        </ul>
      </aside>
      <div className="strip">
        <Chips members={members} />
        <span className="sp" />
        <span className="lab">{t.lang(code)}</span>
      </div>
      <section className="main">
        <div className="trh">
          <span className="lab">{t.time}</span>
          <span className="lab">{t.from}</span>
          <span className="lab">{t.transcriptOf(name)}</span>
          <span className="lab">{today()}</span>
        </div>
        <div className="rows" ref={rows}>
          {messages.map((message, index) => (
            <Row key={message.id} message={message} old={index < messages.length - freshRows} />
          ))}
        </div>
        <form className="cmp" onSubmit={send}>
          <span className="tx">TX →</span>
          <input aria-label={t.messageForCari} placeholder={t.writeToCari} value={draft} maxLength={2000} onChange={(event) => setDraft(event.target.value)} />
          <button type="submit" className="b" disabled={sending}>
            {t.send}
          </button>
        </form>
      </section>
    </div>
  );
}

type State = { kind: "loading" } | { kind: "missing" } | { kind: "failed" } | { kind: "ready"; sheet: RunSheet };

export function RunPage({ id, onMap }: { id: string; onMap: (name: string | undefined) => void }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(() => {
    fetchRun(id)
      .then((sheet) => {
        onMap(sheet.you ? sheet.map.name[lang] : undefined);
        setState({ kind: "ready", sheet });
      })
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        setState({ kind: error instanceof Refused && error.status === 404 ? "missing" : "failed" });
      });
  }, [id, onMap]);

  useEffect(load, [load]);

  if (state.kind === "loading") return null;
  if (state.kind !== "ready")
    return (
      <div className="maps-list solo">
        <div className="notice">
          <p className="none">{state.kind === "missing" ? t.noSuchRun : t.failed}</p>
          <Link to="/" className="b b-line">
            {t.maps}
          </Link>
        </div>
      </div>
    );
  return state.sheet.you ? <RunView sheet={state.sheet} /> : <JoinView sheet={state.sheet} onJoined={load} />;
}
