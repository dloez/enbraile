import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Language } from "../shared/bundle";
import type { Card, Member, Message, RunSheet } from "../shared/runs";
import { askMore, type Listener, fetchRun, fetchTranscript, joinRun, Refused, sendMessage, SignedOut, signIn } from "./api";
import { languageNames, lang, t } from "./i18n";
import { mapPath, runPath } from "./route";
import { Chip, Chips, Down, LeaveNote, Link, LinkIcon, MapHead, Notice, type RunLink, useFit } from "./ui";

const pollMs = 2000;
const freshRows = 4;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function clock(at: string): string {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const cariWords: Record<Language, { dispatch: string; more: string; transmitting: string; writing: string }> = {
  es: { dispatch: "Despacho", more: "Más", transmitting: "transmitiendo", writing: "Cari escribe" },
  en: { dispatch: "Dispatch", more: "More", transmitting: "transmitting", writing: "Cari is writing" },
};

function JoinView({ sheet, onJoined }: { sheet: RunSheet; onJoined: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = sheet.map.name[lang];
  const starter = sheet.members.findIndex((member) => member.name === sheet.startedBy);

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
    <main className="page two join">
      <MapHead back eyebrow={t.runOf(sheet.startedBy)} name={name} art={sheet.map.art} plan={t.planOf(name)} />
      <div className="side">
        <div className="card join-card">
          <div className="join-grid">
            <div>
              <span className="lab">{t.inTheRun}</span>
              <ul className="mem">
                {sheet.members.map((member, index) => (
                  <li key={index}>
                    <Chip name={member.name} you={member.you} />
                    {member.name}
                    {index === starter && <span className="m wide"> {t.startedIt}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="lab">{t.cariSpeaks}</span>
              <p className="val">{languageNames[sheet.language]}</p>
            </div>
          </div>
          {failed && (
            <p className="state" role="alert">
              {t.failed}
            </p>
          )}
          <button type="button" className="b b-red wide-b" disabled={busy} onClick={join}>
            {t.joinTheRun}
          </button>
        </div>
        {sheet.yourRun && <LeaveNote before={t.leaveOnJoin} name={sheet.yourRun.name[lang]} after={t.leaveAfter} />}
        <Link to={mapPath(sheet.map.game, sheet.map.map)} className="link">
          {t.otherRuns}
        </Link>
      </div>
    </main>
  );
}

function Slip({ card, language, busy, onMore }: { card: Card; language: Language; busy: boolean; onMore: (card: number) => void }) {
  const words = cariWords[language];
  return (
    <div className="slip" lang={language}>
      <div className="slip-h">
        <b>{words.dispatch}</b>
        <span>Cari · {clock(card.at)}</span>
      </div>
      {card.rungs.map((rung, index) => (
        <p key={rung.id} className={index < card.rungs.length - 1 ? "rung rung-old" : "rung"}>
          {rung.text}
        </p>
      ))}
      {card.more ? (
        <div className="slip-f">
          <button type="button" className="more" disabled={busy} onClick={() => onMore(card.id)}>
            <Down /> {words.more}
          </button>
        </div>
      ) : (
        <div className="slip-end" />
      )}
    </div>
  );
}

function Line({ at, cari, name, className, children }: { at: string; cari: boolean; name: string; className: string; children: ReactNode }) {
  const time = clock(at);
  return (
    <div className={className}>
      <span className="t">{time}</span>
      <div>
        <p className={cari ? "who who-cari" : "who"}>
          {name}
          <span className="t t-in">{time}</span>
        </p>
        {children}
      </div>
    </div>
  );
}

function Row({ message, card, old, slip }: { message: Message; card: Card | undefined; old: boolean; slip: (card: Card) => ReactNode }) {
  const cari = message.author === "cari";
  return (
    <Line at={message.at} cari={cari} name={cari ? "Cari" : message.name} className={old ? "row old" : message.id < 0 ? "row sending" : "row"}>
      <p className="msg">{message.text}</p>
      {card && slip(card)}
    </Line>
  );
}

function Transmitting({ text, at, language }: { text: string; at: string; language: Language }) {
  const words = cariWords[language];
  return (
    <Line at={at} cari name="Cari" className="row">
      <p className={text ? "msg" : "typing"} lang={language}>
        {text || words.transmitting}
        <span className="caret" role="img" aria-label={words.writing} />
      </p>
    </Line>
  );
}

function CopyLink({ id, icon }: { id: string; icon: boolean }) {
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    if (!said) return;
    const timer = setTimeout(() => setSaid(null), 2000);
    return () => clearTimeout(timer);
  }, [said]);
  const copy = () => {
    navigator.clipboard
      .writeText(`${location.origin}${runPath(id)}`)
      .then(() => setSaid(t.copied))
      .catch(() => setSaid(t.notCopied));
  };
  return (
    <>
      {icon ? (
        <button type="button" className="ib" aria-label={t.copyRunLink} onClick={copy}>
          <LinkIcon size={20} />
        </button>
      ) : (
        <button type="button" className="b b-ghost copy" onClick={copy}>
          <LinkIcon /> {said ?? t.copyLink}
        </button>
      )}
      <span className="sr" role="status">
        {said ?? ""}
      </span>
    </>
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

  const slip = (card: Card) => <Slip card={card} language={sheet.language} busy={airing !== null} onMore={more} />;
  const notice = trouble ?? (lost ? { text: t.failed, retry: () => void poll() } : null);

  return (
    <div className="runv">
      <aside className="rail">
        <div>
          <span className="lab">{t.yourRun}</span>
          <h2 ref={title} className="cond">
            {name}
          </h2>
          <p className="sub">{t.cariSpeaksIn[sheet.language]}</p>
        </div>
        <div>
          <span className="lab">{t.inTheRun}</span>
          <ul className="mem">
            {members.map((member, index) => (
              <li key={index}>
                <Chip name={member.name} you={member.you} />
                {member.name}
                {member.you && <span className="y"> {t.you}</span>}
              </li>
            ))}
          </ul>
          <CopyLink id={sheet.id} icon={false} />
        </div>
      </aside>
      <div className="strip">
        <Chips members={members} />
        <span className="m">{t.cariSpeaksIn[sheet.language]}</span>
        <span className="sp" />
        <CopyLink id={sheet.id} icon />
      </div>
      <section className="main">
        <div className="rows" ref={rows} onScroll={onScroll}>
          {!loaded && (
            <p className="state quiet" role="status">
              {t.receiving}
            </p>
          )}
          {loaded && !shown.length && airing === null && <p className="state quiet">{t.quiet}</p>}
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
            <p className="state">{notice.text}</p>
            <button type="button" className="b b-ghost" onClick={notice.retry} disabled={airing !== null}>
              {t.retry}
            </button>
          </div>
        )}
        <form className="cmp" onSubmit={send}>
          <input className="field" aria-label={t.messageForCari} placeholder={t.writeToCari} value={draft} maxLength={2000} onChange={(event) => setDraft(event.target.value)} />
          <button type="submit" className="b" disabled={airing !== null}>
            {t.send}
          </button>
        </form>
      </section>
    </div>
  );
}

type State = { kind: "loading" } | { kind: "missing" } | { kind: "failed" } | { kind: "ready"; sheet: RunSheet };

export function RunPage({ id, onMap, onYourRun }: { id: string; onMap: (name: string | undefined) => void; onYourRun: (run: RunLink | null) => void }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(() => {
    setState((current) => (current.kind === "ready" ? current : { kind: "loading" }));
    fetchRun(id)
      .then((sheet) => {
        onMap(sheet.you ? sheet.map.name[lang] : undefined);
        onYourRun(sheet.you ? { id: sheet.id, name: sheet.map.name } : sheet.yourRun);
        setState({ kind: "ready", sheet });
      })
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        onMap(undefined);
        setState({ kind: error instanceof Refused && error.status === 404 ? "missing" : "failed" });
      });
  }, [id, onMap, onYourRun]);

  useEffect(load, [load]);

  if (state.kind === "loading")
    return (
      <main className="page">
        <Notice text={t.receiving} />
      </main>
    );
  if (state.kind !== "ready")
    return (
      <main className="page">
        <Notice text={state.kind === "missing" ? t.noSuchRun : t.failed} alert>
          {state.kind === "failed" ? (
            <button type="button" className="b b-ghost" onClick={load}>
              {t.retry}
            </button>
          ) : (
            <Link to="/" className="b b-ghost">
              {t.maps}
            </Link>
          )}
        </Notice>
      </main>
    );
  return state.sheet.you ? <RunView sheet={state.sheet} /> : <JoinView sheet={state.sheet} onJoined={load} />;
}
