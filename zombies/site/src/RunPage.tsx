import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Language } from "../shared/bundle";
import type { Card, Member, Message, RunSheet } from "../shared/runs";
import { askMore, type Listener, fetchRun, fetchTranscript, joinRun, Refused, sendMessage, SignedOut, signIn } from "./api";
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

const cariWords: Record<Language, { dispatch: string; more: string; transmitting: string; writing: string }> = {
  es: { dispatch: "Despacho", more: "Más", transmitting: "transmitiendo", writing: "Cari escribe" },
  en: { dispatch: "Dispatch", more: "More", transmitting: "transmitting", writing: "Cari is writing" },
};

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

function Down() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" aria-hidden="true">
      <path d="M12 4v15M5 13l7 7 7-7" />
    </svg>
  );
}

function Slip({ card, language, busy, onMore }: { card: Card; language: Language; busy: boolean; onMore: (card: number) => void }) {
  const words = cariWords[language];
  return (
    <div className="slip" lang={language}>
      <div className="slip-h">
        <b>{words.dispatch}</b>
        <span>Cari · {clock(card.at, false)}</span>
      </div>
      {card.rungs.map((rung, index) => (
        <p key={rung.id} className={index < card.rungs.length - 1 ? "rung rung-old" : "rung"}>
          {rung.text}
        </p>
      ))}
      {card.more && (
        <div className="slip-f">
          <button type="button" className="b" disabled={busy} onClick={() => onMore(card.id)}>
            <Down /> {words.more}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ message, card, old, slip }: { message: Message; card: Card | undefined; old: boolean; slip: (card: Card) => ReactNode }) {
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
        {card && slip(card)}
      </div>
    </div>
  );
}

function Transmitting({ text, language }: { text: string; language: Language }) {
  const now = new Date().toISOString();
  const words = cariWords[language];
  return (
    <div className="row">
      <span className="t">
        <span className="t-long">{clock(now, true)}</span>
        <span className="t-short">{clock(now, false)}</span>
      </span>
      <span className="who who-cari">Cari</span>
      <div className="msg">
        <p className={text ? "txt" : "txt ty"} lang={language}>
          {text || words.transmitting}
          <span className="caret" role="img" aria-label={words.writing} />
        </p>
      </div>
    </div>
  );
}

function RunView({ sheet }: { sheet: RunSheet }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [cards, setCards] = useState<Map<number, Card>>(new Map());
  const [members, setMembers] = useState<Member[]>(sheet.members);
  const [draft, setDraft] = useState("");
  const [airing, setAiring] = useState<string | null>(null);
  const last = useRef(0);
  const lastRung = useRef(0);
  const rows = useRef<HTMLDivElement>(null);
  const name = sheet.map.name[lang];

  const poll = useCallback(async () => {
    try {
      const reply = await fetchTranscript(sheet.id, last.current, lastRung.current);
      setMembers(reply.members);
      if (reply.cards.length) {
        lastRung.current = Math.max(lastRung.current, ...reply.cards.flatMap((card) => card.rungs.map((rung) => rung.id)));
        setCards((current) => new Map([...current, ...reply.cards.map((card): [number, Card] => [card.id, card])]));
      }
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

  const rungCount = [...cards.values()].reduce((sum, card) => sum + card.rungs.length, 0);

  useLayoutEffect(() => {
    const element = rows.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length, rungCount, airing]);

  const listen = (start: (listener: Listener) => Promise<void>) => {
    setAiring("");
    let said = "";
    return start({
      opened: () => void poll(),
      heard: (event) => {
        if (event.type !== "text") return;
        said += event.text;
        setAiring(said);
      },
    })
      .catch((error: unknown) => error instanceof SignedOut && signIn())
      .then(poll)
      .finally(() => setAiring(null));
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || airing !== null) return;
    setDraft("");
    void listen((listener) => sendMessage(sheet.id, text, listener));
  };

  const more = (card: number) => {
    if (airing !== null) return;
    void listen((listener) => askMore(sheet.id, card, listener));
  };

  const code = sheet.language.toUpperCase();
  const slip = (card: Card) => <Slip card={card} language={sheet.language} busy={airing !== null} onMore={more} />;

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
            <Row
              key={message.id}
              message={message}
              card={message.card === null ? undefined : cards.get(message.card)}
              old={index < messages.length - freshRows}
              slip={slip}
            />
          ))}
          {airing !== null && <Transmitting text={airing} language={sheet.language} />}
        </div>
        <form className="cmp" onSubmit={send}>
          <span className="tx">TX →</span>
          <input aria-label={t.messageForCari} placeholder={t.writeToCari} value={draft} maxLength={2000} onChange={(event) => setDraft(event.target.value)} />
          <button type="submit" className="b" disabled={airing !== null}>
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
