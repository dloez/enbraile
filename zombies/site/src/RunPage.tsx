import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Language, Viewer } from "../shared/bundle";
import { asRevision, ratings, type CallState, type Card, type VoiceChannel, type Member, type Message, type Rating, type RunSheet } from "../shared/runs";
import { askMore, bringCari, fetchCall, type Listener, fetchTranscript, joinRun, rateCard, Refused, sendMessage, SignedOut, signIn } from "./api";
import { languageNames, lang, t } from "./i18n";
import { mapPath, runPath } from "./route";
import { SurveyZone } from "./art";
import { JoinSkeleton, RowsSkeleton, RunSkeleton } from "./skeletons";
import { forget, known, load as fetchPage, openFreshMs, runSource } from "./store";
import { Arrow, Chip, Chips, Down, LeaveNote, Link, LinkIcon, MapHead, Mic, Notice, Pencil, type RunLink, useFit } from "./ui";

const pollMs = 2000;
const callPollMs = 10000;
const freshRows = 4;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function clock(at: string): string {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const cariWords: Record<Language, { dispatch: string; more: string; transmitting: string; writing: string; rate: string; zone: string; ratings: Record<Rating, string> }> = {
  es: {
    dispatch: "Despacho",
    zone: "Mapa con una zona marcada en rojo",
    more: "Más",
    transmitting: "transmitiendo",
    writing: "Cari escribe",
    rate: "Valora esta pista",
    ratings: { obvious: "Demasiado obvia", right: "Justa", vague: "Demasiado vaga" },
  },
  en: {
    dispatch: "Dispatch",
    zone: "Map with an area marked in red",
    more: "More",
    transmitting: "transmitting",
    writing: "Cari is writing",
    rate: "Rate this hint",
    ratings: { obvious: "Too obvious", right: "Right", vague: "Too vague" },
  },
};

function JoinView({ sheet, arrive, onJoined }: { sheet: RunSheet; arrive: boolean; onJoined: () => void }) {
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
    <main className={arrive ? "page two join arrive" : "page two join"}>
      <MapHead back eyebrow={t.runOf(sheet.startedBy)} name={name} map={sheet.map} label={sheet.map.image ? t.artOf(name) : t.planOf(name)} />
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

function Feedback({ card, language, rating, onRate }: { card: number; language: Language; rating: Rating | null; onRate: (card: number, rating: Rating) => void }) {
  const words = cariWords[language];
  return (
    <fieldset className="fb">
      <legend>{words.rate}</legend>
      {ratings.map((value) => (
        <label key={value}>
          <input type="radio" name={`fb-${card}`} value={value} checked={rating === value} onChange={() => onRate(card, value)} />
          {words.ratings[value]}
        </label>
      ))}
    </fieldset>
  );
}

function Slip({
  card,
  language,
  art,
  busy,
  rating,
  onMore,
  onRate,
}: {
  card: Card;
  language: Language;
  art: RunSheet["map"]["art"];
  busy: boolean;
  rating: Rating | null;
  onMore: (card: number) => void;
  onRate: (card: number, rating: Rating) => void;
}) {
  const words = cariWords[language];
  return (
    <div className="slip" lang={language}>
      <div className="slip-h">
        <b>{words.dispatch}</b>
        <span>Cari · {clock(card.at)}</span>
      </div>
      {card.rungs.map((rung, index) => (
        <div key={rung.id} className={index < card.rungs.length - 1 ? "rung-old" : undefined}>
          <p className="rung">{rung.text}</p>
          {rung.zone && <SurveyZone zone={rung.zone} art={art} label={words.zone} />}
        </div>
      ))}
      <div className="slip-f">
        {card.more && (
          <button type="button" className="more" disabled={busy} onClick={() => onMore(card.id)}>
            <Down /> {words.more}
          </button>
        )}
        <Feedback card={card.id} language={language} rating={rating} onRate={onRate} />
      </div>
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
  if (message.revision) {
    const time = clock(message.at);
    return (
      <div className={message.id === -1 ? "row sending" : "row"}>
        <span className="t">{time}</span>
        <div>
          <p className="who who-rev">
            {message.name}
            <span className="t t-in">{time}</span>
            <span className="tag">{t.revision}</span>
          </p>
          <p className="revmsg">{message.text}</p>
          <span className="re">{t.re(message.revision.re && clock(message.revision.re))}</span>
        </div>
      </div>
    );
  }
  return (
    <Line at={message.at} cari={cari} name={cari ? "Cari" : message.name} className={old ? "row old" : message.id === -1 ? "row sending" : "row"}>
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

type Voice = { channel: VoiceChannel; here: boolean; busy: boolean; refused: string | null; bring: () => void };

function useVoice(id: string): Voice | null {
  const [state, setState] = useState<CallState | null>(null);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const look = useCallback(() => {
    if (document.hidden) return;
    fetchCall(id)
      .then((next) => {
        setState(next);
        setRefused(null);
      })
      .catch((error: unknown) => {
        if (error instanceof SignedOut) signIn();
      });
  }, [id]);

  useEffect(() => {
    look();
    const timer = setInterval(look, callPollMs);
    document.addEventListener("visibilitychange", look);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", look);
    };
  }, [look]);

  const channel = state?.reachable ? state.channel : null;
  if (!channel) return null;

  const bring = () => {
    setBusy(true);
    setRefused(null);
    bringCari(id)
      .then((joined) => {
        if ("error" in joined) setRefused(t.joinRefused[joined.error]);
        else setState((current) => current && { ...current, cari: joined.channelId });
      })
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        setRefused(t.joinRefused.botOffline);
      })
      .finally(() => setBusy(false));
  };

  return { channel, here: state?.cari === channel.id, busy, refused, bring };
}

function voiceLine(voice: Voice): string {
  const { channel } = voice;
  if (voice.here) return t.cariIsIn(channel.name);
  return channel.reason ? t.cantJoin[channel.reason](channel.name) : t.youreInChannel(channel.name);
}

function Meter({ bars }: { bars: number }) {
  return (
    <div className="meter" aria-hidden="true">
      {Array.from({ length: bars }, (_, index) => (
        <i key={index} />
      ))}
    </div>
  );
}

function VoicePanel({ voice }: { voice: Voice }) {
  return (
    <section className={voice.here ? "voice on" : "voice"} aria-label={t.voiceChannel}>
      <div>
        <span className="lab">{voice.here ? t.onAir : t.voiceChannel}</span>
        <p className="big">{voiceLine(voice)}</p>
      </div>
      {voice.here && <Meter bars={20} />}
      {!voice.here && voice.channel.canJoin && (
        <button type="button" className="b b-red" disabled={voice.busy} onClick={voice.bring}>
          {t.bringCari}
          <Arrow size={20} />
        </button>
      )}
      {voice.refused && (
        <p className="state" role="alert">
          {voice.refused}
        </p>
      )}
      {voice.here && <p className="state">{t.sayCari}</p>}
    </section>
  );
}

function VoiceBar({ voice }: { voice: Voice }) {
  return (
    <section className={voice.here ? "vb on" : "vb"} aria-label={t.voiceChannel}>
      {!voice.here && <Mic />}
      <p>
        {voice.here ? (
          <>
            {t.onAir}
            <br />
            <span className="state">{voiceLine(voice)}</span>
          </>
        ) : (
          (voice.refused ?? voiceLine(voice))
        )}
      </p>
      <span className="sp" />
      {voice.here && <Meter bars={14} />}
      {!voice.here && voice.channel.canJoin && (
        <button type="button" className="b b-red" disabled={voice.busy} onClick={voice.bring}>
          {t.bringCari}
        </button>
      )}
    </section>
  );
}

type Trouble = { text: string; retry: () => void };

type Log = { history: Message[]; messages: Message[]; cards: Map<number, Card>; members: Member[]; rated: Map<number, Rating>; last: number; lastRung: number };

const logs = new Map<string, Log>();

function RunView({ sheet, arrive }: { sheet: RunSheet; arrive: boolean }) {
  const [log] = useState(() => logs.get(sheet.id));
  const [history, setHistory] = useState<Message[]>(log?.history ?? []);
  const [messages, setMessages] = useState<Message[]>(log?.messages ?? []);
  const [cards, setCards] = useState<Map<number, Card>>(log?.cards ?? new Map());
  const [members, setMembers] = useState<Member[]>(log?.members ?? sheet.members);
  const [loaded, setLoaded] = useState(log !== undefined);
  const [lost, setLost] = useState(false);
  const [settled, setSettled] = useState(log !== undefined);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Message | null>(null);
  const [airing, setAiring] = useState<{ text: string; at: string } | null>(null);
  const [trouble, setTrouble] = useState<Trouble | null>(null);
  const [revising, setRevising] = useState(false);
  const [rated, setRated] = useState<Map<number, Rating>>(log?.rated ?? new Map());
  const last = useRef(log?.last ?? 0);
  const lastRung = useRef(log?.lastRung ?? 0);
  const rows = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const polling = useRef(0);
  const name = sheet.map.name[lang];
  const title = useFit<HTMLHeadingElement>(name);
  const voice = useVoice(sheet.id);

  const poll = useCallback(async () => {
    polling.current++;
    try {
      const reply = await fetchTranscript(sheet.id, last.current, lastRung.current);
      setMembers(reply.members);
      if (reply.history.length) setHistory(reply.history);
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

  useEffect(() => {
    if (loaded) logs.set(sheet.id, { history, messages, cards, members, rated, last: last.current, lastRung: lastRung.current });
  }, [sheet.id, loaded, history, messages, cards, members, rated]);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => setSettled(true), 600);
    return () => clearTimeout(timer);
  }, [loaded]);

  const shown = [...history, ...messages, ...(pending ? [pending] : [])];
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

  const transmit = (text: string, flagged: boolean) => {
    const you = members.find((member) => member.you);
    const revision = asRevision(text, flagged);
    setDraft((current) => (current.trim() === text ? "" : current));
    setPending({
      id: -1,
      author: "member",
      revision: revision === null ? null : { re: null },
      name: you?.name ?? "",
      you: true,
      text: revision ?? text,
      at: new Date().toISOString(),
      card: null,
    });
    void listen(
      (listener) => sendMessage(sheet.id, text, flagged, listener),
      () => transmit(text, flagged),
      () => {
        setPending(null);
        setDraft((current) => current || text);
        if (flagged) setRevising(true);
      },
    );
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || airing !== null || asRevision(text, revising) === "") return;
    setDraft("");
    setRevising(false);
    transmit(text, revising);
  };

  const rate = (card: number, rating: Rating) => {
    const before = rated.get(card) ?? cards.get(card)?.rating ?? null;
    const put = (value: Rating | null) =>
      setRated((current) => {
        const next = new Map(current);
        if (value) next.set(card, value);
        else next.delete(card);
        return next;
      });
    put(rating);
    rateCard(sheet.id, card, rating).catch((error: unknown) => {
      if (error instanceof SignedOut) return signIn();
      put(before);
      setTrouble({ text: t.notRated, retry: () => rate(card, rating) });
    });
  };

  const more = (card: number) => {
    if (airing !== null) return;
    void listen(
      (listener) => askMore(sheet.id, card, listener),
      () => more(card),
    );
  };

  const slip = (card: Card) => (
    <Slip card={card} language={sheet.language} art={sheet.map.art} busy={airing !== null} rating={rated.get(card.id) ?? card.rating} onMore={more} onRate={rate} />
  );
  const notice = trouble ?? (lost ? { text: t.failed, retry: () => void poll() } : null);

  return (
    <div className={arrive ? "runv arrive" : "runv"}>
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
        {voice && <VoicePanel voice={voice} />}
      </aside>
      <div className="strip">
        <Chips members={members} />
        <span className="m">{t.cariSpeaksIn[sheet.language]}</span>
        <span className="sp" />
        <CopyLink id={sheet.id} icon />
      </div>
      {voice && <VoiceBar voice={voice} />}
      <section className="main">
        <div className={loaded && !settled ? "rows arrive-all" : "rows"} ref={rows} onScroll={onScroll} aria-busy={!loaded}>
          {!loaded && <RowsSkeleton />}
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
        <form className={revising ? "cmp cmp-rev" : "cmp"} onSubmit={send}>
          {revising && <p className="mode">{t.revisionMode}</p>}
          <div className="cmp-in">
            <input
              className="field"
              aria-label={revising ? t.revision : t.messageForCari}
              placeholder={revising ? t.commentOnCoaching : t.writeToCari}
              value={draft}
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="button" className="revb" aria-pressed={revising} aria-label={t.revision} onClick={() => setRevising((current) => !current)}>
              <Pencil />
              <span className="revb-w">{t.revision}</span>
            </button>
            <button type="submit" className={revising ? "b b-blue" : "b"} disabled={airing !== null}>
              {t.send}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

type State = { kind: "loading" } | { kind: "missing" } | { kind: "failed" } | { kind: "ready"; sheet: RunSheet };

export function RunPage({
  id,
  expect,
  onMap,
  onYourRun,
  onViewer,
}: {
  id: string;
  expect: "run" | "join";
  onMap: (name: string | undefined) => void;
  onYourRun: (run: RunLink | null) => void;
  onViewer: (viewer: Viewer | null) => void;
}) {
  const source = useMemo(() => runSource(id), [id]);
  const [atOnce] = useState(() => known(source) !== undefined);
  const [state, setState] = useState<State>(() => {
    const sheet = known(source);
    return sheet ? { kind: "ready", sheet } : { kind: "loading" };
  });

  const asked = useRef(0);
  const load = useCallback(
    (freshMs: number) => {
      const ask = ++asked.current;
      setState((current) => (current.kind === "ready" ? current : { kind: "loading" }));
      fetchPage(source, freshMs)
        .then((sheet) => {
          if (ask !== asked.current) return;
          onViewer(sheet.viewer);
          onMap(sheet.you ? sheet.map.name[lang] : undefined);
          onYourRun(sheet.you ? { id: sheet.id, name: sheet.map.name } : sheet.yourRun);
          setState({ kind: "ready", sheet });
        })
        .catch((error: unknown) => {
          if (error instanceof SignedOut) return signIn();
          if (ask !== asked.current) return;
          onViewer(null);
          if (error instanceof Refused && error.status === 404) {
            forget(source);
            logs.delete(id);
            onMap(undefined);
            setState({ kind: "missing" });
          } else {
            if (!known(source)) onMap(undefined);
            setState((current) => (current.kind === "ready" ? current : { kind: "failed" }));
          }
        });
    },
    [id, source, onMap, onYourRun, onViewer],
  );
  const retry = useCallback(() => {
    forget(source);
    load(0);
  }, [source, load]);

  useEffect(() => load(openFreshMs), [load]);

  if (state.kind === "loading") return expect === "run" ? <RunSkeleton /> : <JoinSkeleton />;
  if (state.kind !== "ready")
    return (
      <main className="page">
        <Notice text={state.kind === "missing" ? t.noSuchRun : t.failed} alert>
          {state.kind === "failed" ? (
            <button type="button" className="b b-ghost" onClick={retry}>
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
  return state.sheet.you ? <RunView sheet={state.sheet} arrive={!atOnce} /> : <JoinView sheet={state.sheet} arrive={!atOnce} onJoined={retry} />;
}
