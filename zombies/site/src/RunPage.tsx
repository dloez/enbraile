import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Language } from "../shared/bundle";
import type { Card, Member, Message, RunSheet } from "../shared/runs";
import { askMore, type Listener, fetchRun, fetchTranscript, joinRun, Refused, sendMessage, SignedOut, signIn } from "./api";
import { MapPlan } from "./art";
import { languageNames, lang, t } from "./i18n";
import { Arrow, Chips, initials, LeaveNote, Link, useFit } from "./ui";

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
  const title = useFit<HTMLHeadingElement>(name);

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
        <h1 ref={title} className="cond">
          {name}
        </h1>
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
        {failed && (
          <p className="none" role="alert">
            {t.failed}
          </p>
        )}
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
    <div className={old ? "row old" : message.id < 0 ? "row sending" : "row"}>
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

function Transmitting({ text, at: now, language }: { text: string; at: string; language: Language }) {
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

type Trouble = { text: string; retry: () => void };

function RunView({ sheet }: { sheet: RunSheet }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [cards, setCards] = useState<Map<number, Card>>(new Map());
  const [members, setMembers] = useState<Member[]>(sheet.members);
  const [loaded, setLoaded] = useState(false);
  const [lost, setLost] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Message | null>(null);
  const [airing, setAiring] = useState<{ text: string; at: string } | null>(null);
  const [trouble, setTrouble] = useState<Trouble | null>(null);
  const last = useRef(0);
  const lastRung = useRef(0);
  const rows = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const polling = useRef(0);
  const name = sheet.map.name[lang];
  const title = useFit<HTMLHeadingElement>(name);

  const poll = useCallback(async () => {
    polling.current++;
    try {
      const reply = await fetchTranscript(sheet.id, last.current, lastRung.current);
      setMembers(reply.members);
      setLoaded(true);
      setLost(false);
      if (reply.cards.length) {
        lastRung.current = Math.max(lastRung.current, ...reply.cards.flatMap((card) => card.rungs.map((rung) => rung.id)));
        setCards((current) => new Map([...current, ...reply.cards.map((card): [number, Card] => [card.id, (current.get(card.id)?.rungs.length ?? 0) > card.rungs.length ? current.get(card.id)! : card])]));
      }
      const fresh = reply.messages.filter((message) => message.id > last.current);
      if (fresh.length) {
        last.current = fresh[fresh.length - 1]!.id;
        setMessages((current) => [...current, ...fresh]);
        if (fresh.some((message) => message.you)) setPending(null);
      }
    } catch (error) {
      if (error instanceof SignedOut) signIn();
      else if (error instanceof Refused && error.status === 403) location.reload();
      else setLost(true);
    } finally {
      polling.current--;
    }
  }, [sheet.id]);

  useEffect(() => {
    void poll();
    const tick = () => document.hidden || polling.current > 0 || void poll();
    const timer = setInterval(tick, pollMs);
    const onShow = () => document.hidden || polling.current > 0 || void poll();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [poll]);

  const shown = pending ? [...messages, pending] : messages;
  const rungCount = [...cards.values()].reduce((sum, card) => sum + card.rungs.length, 0);

  useLayoutEffect(() => {
    const element = rows.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [shown.length, rungCount, airing?.text, airing === null, loaded, trouble, lost]);

  useEffect(() => {
    const element = rows.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (stick.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const onScroll = () => {
    const element = rows.current;
    if (element) stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
  };

  const listen = (start: (listener: Listener) => Promise<void>, retry: () => void, unsent?: () => void) => {
    setTrouble(null);
    setAiring({ text: "", at: new Date().toISOString() });
    stick.current = true;
    let opened = false;
    let failed = false;
    let said = "";
    return start({
      opened: () => {
        opened = true;
        void poll();
      },
      heard: (event) => {
        if (event.type === "failed") failed = true;
        if (event.type !== "text") return;
        said += event.text;
        setAiring((current) => current && { ...current, text: said });
      },
    })
      .then(() => failed && setTrouble({ text: t.noAnswer, retry }))
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        if (!opened) unsent?.();
        setTrouble({ text: opened ? t.noAnswer : t.notSent, retry });
      })
      .then(poll)
      .finally(() => setAiring(null));
  };

  const transmit = (text: string) => {
    const you = members.find((member) => member.you);
    setDraft((current) => (current.trim() === text ? "" : current));
    setPending({ id: -1, author: "member", name: you?.name ?? "", you: true, text, at: new Date().toISOString(), card: null });
    void listen(
      (listener) => sendMessage(sheet.id, text, listener),
      () => transmit(text),
      () => {
        setPending(null);
        setDraft((current) => current || text);
      },
    );
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || airing !== null) return;
    setDraft("");
    transmit(text);
  };

  const more = (card: number) => {
    if (airing !== null) return;
    void listen(
      (listener) => askMore(sheet.id, card, listener),
      () => more(card),
    );
  };

  const code = sheet.language.toUpperCase();
  const slip = (card: Card) => <Slip card={card} language={sheet.language} busy={airing !== null} onMore={more} />;
  const notice = trouble ?? (lost ? { text: t.failed, retry: () => void poll() } : null);

  return (
    <div className="run">
      <aside className="rail">
        <span className="lab">{t.runLang(code)}</span>
        <h2 ref={title} className="cond">
          {name}
        </h2>
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
        <div className="rows" ref={rows} onScroll={onScroll}>
          {!loaded && (
            <p className="none quiet" role="status">
              {t.receiving}
            </p>
          )}
          {loaded && !shown.length && airing === null && <p className="none quiet">{t.quiet}</p>}
          {shown.map((message, index) => (
            <Row
              key={message.id}
              message={message}
              card={message.card === null ? undefined : cards.get(message.card)}
              old={index < shown.length - freshRows}
              slip={slip}
            />
          ))}
          {airing !== null && <Transmitting text={airing.text} at={airing.at} language={sheet.language} />}
        </div>
        {notice && (
          <div className="trouble" role="alert">
            <p className="none">{notice.text}</p>
            <button type="button" className="b b-line" onClick={notice.retry} disabled={airing !== null}>
              {t.retry}
            </button>
          </div>
        )}
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
    setState((current) => (current.kind === "ready" ? current : { kind: "loading" }));
    fetchRun(id)
      .then((sheet) => {
        onMap(sheet.you ? sheet.map.name[lang] : undefined);
        setState({ kind: "ready", sheet });
      })
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        onMap(undefined);
        setState({ kind: error instanceof Refused && error.status === 404 ? "missing" : "failed" });
      });
  }, [id, onMap]);

  useEffect(load, [load]);

  if (state.kind !== "ready")
    return (
      <div className="maps-list solo">
        <div className="notice">
          <p className="none" role={state.kind === "loading" ? "status" : "alert"}>
            {state.kind === "loading" ? t.receiving : state.kind === "missing" ? t.noSuchRun : t.failed}
          </p>
          {state.kind === "failed" && (
            <button type="button" className="b b-line" onClick={load}>
              {t.retry}
            </button>
          )}
          {state.kind === "missing" && (
            <Link to="/" className="b b-line">
              {t.maps}
            </Link>
          )}
        </div>
      </div>
    );
  return state.sheet.you ? <RunView sheet={state.sheet} /> : <JoinView sheet={state.sheet} onJoined={load} />;
}
