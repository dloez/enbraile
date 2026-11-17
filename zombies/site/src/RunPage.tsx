import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Language, Viewer } from "../shared/bundle";
import { asRevision, ratings, type CallState, type Card, type VoiceChannel, type Member, type Message, type Queued, type Rating, type Roadmap, type RunSheet } from "../shared/runs";
import { askMore, bringCoach, changeVoice, closeRun, fetchCall, fetchRoadmap, reopenRun, type Listener, fetchTranscript, joinRun, rateCard, Refused, sendMessage, SignedOut, signIn } from "./api";
import { languageNames, lang, t } from "./i18n";
import { mapPath, runPath } from "./route";
import { SurveyZone } from "./art";
import { RoadmapColumn, RoadmapPanel, RoadmapSheet, useFresh } from "./Roadmap";
import { JoinSkeleton, RowsSkeleton, RunSkeleton } from "./skeletons";
import { characterOf, voiceNames, voices, type Character, type Voice as CoachVoice } from "../shared/voices";
import { forget, known, learn, load as fetchPage, openFreshMs, runSource, nameOf } from "./store";
import { Arrow, Chips, Down, LeaveNote, Link, LinkIcon, MapHead, Mic, Notice, Pencil, PersonChip, Route, Shut, type RunLink, useFit } from "./ui";

const pollMs = 2000;
const lostPollMs = 5000;
const lostAfterMs = 8000;
const callPollMs = 10000;
const freshRows = 4;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function clock(at: string): string {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const coachWords: Record<Language, { dispatch: string; pinned: string; pins: string; earlier: string; fewer: string; more: string; transmitting: string; writing: (name: string) => string; rate: string; zone: { zone: string; whole: string; near: string }; ratings: Record<Rating, string> }> = {
  es: {
    dispatch: "Despacho",
    pinned: "Fijada",
    pins: "Pistas en curso",
    earlier: "Ver las pistas anteriores",
    fewer: "Ocultar las anteriores",
    zone: { zone: "Mapa con un punto marcado en rojo", whole: "Ver el mapa entero", near: "Volver al punto" },
    more: "Más",
    transmitting: "transmitiendo",
    writing: (name: string) => `${name} escribe`,
    rate: "Valora esta pista",
    ratings: { obvious: "Demasiado obvia", right: "Justa", vague: "Demasiado vaga" },
  },
  en: {
    dispatch: "Dispatch",
    pinned: "Pinned",
    pins: "Hints in progress",
    earlier: "Show the earlier hints",
    fewer: "Hide the earlier ones",
    zone: { zone: "Map with a spot marked in red", whole: "Show the whole map", near: "Back to the spot" },
    more: "More",
    transmitting: "transmitting",
    writing: (name: string) => `${name} is writing`,
    rate: "Rate this hint",
    ratings: { obvious: "Too obvious", right: "Right", vague: "Too vague" },
  },
};

function JoinView({ sheet, arrive, onJoined }: { sheet: RunSheet; arrive: boolean; onJoined: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = sheet.map.name[lang];
  const starter = sheet.members.findIndex((member) => (member.who && member.who === sheet.startedBy.who) || member.name === sheet.startedBy.name);

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
      <MapHead back eyebrow={t.runOf(nameOf(sheet.startedBy))} name={name} map={sheet.map} label={sheet.map.image ? t.artOf(name) : t.planOf(name)} />
      <div className="side">
        <div className="card join-card">
          <div className="join-grid">
            <div>
              <span className="lab">{t.inTheRun}</span>
              <ul className="mem">
                {sheet.members.map((member, index) => (
                  <li key={index}>
                    <PersonChip person={member} you={member.you} />
                    {nameOf(member)}
                    {index === starter && <span className="m wide"> {t.startedIt}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="lab">{t.speaks(characterOf(sheet.voice).name)}</span>
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
  const words = coachWords[language];
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

type Rung = Card["rungs"][number];

function Rungs({ rungs, art, language, newest }: { rungs: Rung[]; art: RunSheet["map"]["art"]; language: Language; newest?: (element: HTMLDivElement | null) => void }) {
  const words = coachWords[language];
  return (
    <>
      {rungs.map((rung, index) => {
        const last = index === rungs.length - 1;
        return (
          <div key={rung.id} ref={last ? newest : undefined} className={last ? undefined : "rung-old"}>
            <p className="rung">{rung.text}</p>
            {rung.zone && <SurveyZone zone={rung.zone} art={art} words={words.zone} />}
          </div>
        );
      })}
    </>
  );
}

function SlipFoot({ card, language, busy, rating, onMore, onRate }: { card: Card; language: Language; busy: boolean; rating: Rating | null; onMore: (card: number) => void; onRate: (card: number, rating: Rating) => void }) {
  const words = coachWords[language];
  return (
    <div className="slip-f">
      {card.more && (
        <button type="button" className="more" disabled={busy} onClick={() => onMore(card.id)}>
          <Down /> {words.more}
        </button>
      )}
      <Feedback card={card.id} language={language} rating={rating} onRate={onRate} />
    </div>
  );
}

type SlipProps = {
  still?: boolean;
  name: string;
  language: Language;
  art: RunSheet["map"]["art"];
  busy: boolean;
  rating: Rating | null;
  onMore: (card: number) => void;
  onRate: (card: number, rating: Rating) => void;
};

function Slip({ card, pinned, still, name, language, art, busy, rating, onMore, onRate }: SlipProps & { card: Card; pinned: boolean }) {
  const words = coachWords[language];
  return (
    <div className={pinned ? "slip bare" : "slip"} lang={language}>
      <div className="slip-h">
        <b>{words.dispatch}</b>
        <span>
          {pinned && `${words.pinned} · `}
          {name} · {clock(card.at)}
        </span>
      </div>
      <Rungs rungs={card.rungs} art={art} language={language} />
      {!pinned && !still && <SlipFoot card={card} language={language} busy={busy} rating={rating} onMore={onMore} onRate={onRate} />}
    </div>
  );
}

function PinnedSlip({ thread, still, name, language, art, busy, rating, onMore, onRate }: SlipProps & { thread: Card[] }) {
  const words = coachWords[language];
  const [open, setOpen] = useState(false);
  const latest = thread[thread.length - 1]!;
  const rungs = thread.flatMap((card) => card.rungs);
  const count = rungs.length;
  const newest = useCallback(
    (element: HTMLDivElement | null) => {
      if (element && count) element.scrollIntoView({ block: "nearest" });
    },
    [count],
  );
  return (
    <div className={open ? "slip pin open" : "slip pin"} lang={language}>
      <div className="slip-h">
        <b>{words.dispatch}</b>
        <span>
          {name} · {clock(latest.at)}
        </span>
      </div>
      {count > 1 && (
        <button type="button" className="fold" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          {open ? words.fewer : words.earlier}
        </button>
      )}
      <Rungs rungs={rungs} art={art} language={language} newest={newest} />
      {!still && <SlipFoot card={latest} language={language} busy={busy} rating={rating} onMore={onMore} onRate={onRate} />}
    </div>
  );
}

function Line({ at, fromCoach, name, person, spoken, className, children }: { at: string; fromCoach: boolean; name: string; person?: Member; spoken?: boolean; className: string; children: ReactNode }) {
  const time = clock(at);
  return (
    <div className={className}>
      <span className="t">{time}</span>
      <div>
        <p className={fromCoach ? "who who-coach" : "who"}>
          {person && <PersonChip person={person} you={person.you} small />}
          {name}
          {spoken && (
            <span className="said" title={t.byVoice}>
              <Mic size={14} />
              <span className="sr">{t.byVoice}</span>
            </span>
          )}
          <span className="t t-in">{time}</span>
        </p>
        {children}
      </div>
    </div>
  );
}

function Row({ message, card, old, coach, slip }: { message: Message; card: Card | undefined; old: boolean; coach: string; slip: (card: Card, name: string) => ReactNode }) {
  const fromCoach = message.author === "coach";
  if (message.revision) {
    const time = clock(message.at);
    return (
      <div className={message.id === -1 ? "row sending" : "row"}>
        <span className="t">{time}</span>
        <div>
          <p className="who who-rev">
            <PersonChip person={message} you={message.you} small />
            {nameOf(message)}
            <span className="t t-in">{time}</span>
            <span className="tag">{t.revision}</span>
          </p>
          <p className="revmsg">{message.text}</p>
          <span className="re">{t.re(coach, message.revision.re && clock(message.revision.re))}</span>
        </div>
      </div>
    );
  }
  return (
    <Line at={message.at} fromCoach={fromCoach} name={nameOf(message)} person={fromCoach ? undefined : message} spoken={message.spoken} className={old ? "row old" : message.id === -1 ? "row sending" : "row"}>
      <p className="msg">{message.text}</p>
      {card && slip(card, message.name)}
    </Line>
  );
}

function Transmitting({ text, at, name, language }: { text: string; at: string; name: string; language: Language }) {
  const words = coachWords[language];
  return (
    <Line at={at} fromCoach name={name} className="row">
      <p className={text ? "msg" : "typing"} lang={language}>
        {text || words.transmitting}
        <span className="caret" role="img" aria-label={words.writing(name)} />
      </p>
    </Line>
  );
}

function Queue({ queue, coach }: { queue: Queued[]; coach: string }) {
  const shown = queue.filter((entry) => entry.spoken || !entry.you);
  if (!shown.length) return null;
  return (
    <ol className="queue" aria-label={t.queue} aria-live="polite">
      {shown.map((entry, index) => (
        <li key={`${entry.at}-${index}`} className={entry.answering ? "q-now" : "q-wait"}>
          <PersonChip person={entry} you={entry.you} small />
          <span className="q-who">{entry.answering ? t.answering(coach, nameOf(entry)) : t.waiting(nameOf(entry))}</span>
          {entry.spoken && (
            <span className="said" title={t.byVoice}>
              <Mic size={14} />
              <span className="sr">{t.byVoice}</span>
            </span>
          )}
          {entry.text && <q className="q-text">{entry.text}</q>}
          {entry.answering && <span className="caret" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

function CloseDialog({ coach, busy, onClose, onCancel }: { coach: string; busy: boolean; onClose: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="confirm" aria-labelledby="close-title" onClose={onCancel}>
      <h2 id="close-title" className="cond">
        {t.closeTitle}
      </h2>
      <p>{t.closeBody(coach)}</p>
      <div className="confirm-b">
        <button type="button" className="b b-ghost" onClick={onCancel}>
          {t.keepPlaying}
        </button>
        <button type="button" className="b b-red" disabled={busy} onClick={onClose}>
          {t.closeAttempt}
        </button>
      </div>
    </dialog>
  );
}

function ClosedBar({ closed, canReopen, busy, onReopen }: { closed: NonNullable<RunSheet["closed"]>; canReopen: boolean; busy: boolean; onReopen: () => void }) {
  const by = nameOf(closed.by);
  return (
    <div className="closed-bar">
      <p>
        <b>{by ? t.closedBy(by, clock(closed.at)) : t.closedNoBy(clock(closed.at))}</b> {canReopen && t.reopenHint}
      </p>
      {canReopen && (
        <button type="button" className="b" disabled={busy} onClick={onReopen}>
          {t.reopen}
        </button>
      )}
    </div>
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

function useVoice(id: string, coach: string, off: boolean): Voice | null {
  const [state, setState] = useState<CallState | null>(null);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const looking = useRef(false);

  const look = useCallback(() => {
    if (off || document.hidden || looking.current) return;
    looking.current = true;
    fetchCall(id)
      .then((next) => {
        setState(next);
        setRefused(null);
      })
      .catch((error: unknown) => {
        if (error instanceof SignedOut) signIn();
      })
      .finally(() => {
        looking.current = false;
      });
  }, [id, off]);

  const channel = state?.reachable && !off ? state.channel : null;
  const inChannel = channel !== null;

  useEffect(() => {
    look();
    window.addEventListener("focus", look);
    document.addEventListener("visibilitychange", look);
    return () => {
      window.removeEventListener("focus", look);
      document.removeEventListener("visibilitychange", look);
    };
  }, [look]);

  useEffect(() => {
    const timer = setInterval(look, inChannel ? callPollMs : pollMs);
    return () => clearInterval(timer);
  }, [look, inChannel]);

  if (!channel) return null;

  const bring = () => {
    setBusy(true);
    setRefused(null);
    bringCoach(id)
      .then((joined) => {
        if ("error" in joined) setRefused(t.joinRefused(coach)[joined.error]);
        else setState((current) => current && { ...current, coach: joined.channelId });
      })
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        setRefused(t.joinRefused(coach).botOffline);
      })
      .finally(() => setBusy(false));
  };

  return { channel, here: state?.coach === channel.id, busy, refused, bring };
}

function voiceLine(voice: Voice, coach: Character): string {
  const { channel } = voice;
  return channel.reason ? t.cantJoin[channel.reason](coach.name, channel.name) : t.youreInChannel(channel.name);
}

function Meter({ bars, live }: { bars: number; live: boolean }) {
  return (
    <div className={live ? "meter live" : "meter"} aria-hidden="true">
      {Array.from({ length: bars }, (_, index) => (
        <i key={index} />
      ))}
    </div>
  );
}

function airState(queue: Queued[], coach: Character): { live: boolean; text: string } {
  const now = queue.find((entry) => entry.answering && entry.spoken);
  return now ? { live: true, text: t.speakingTo(coach.name, nameOf(now)) } : { live: false, text: t.listening(coach.name) };
}

function Wake({ wake }: { wake: string }) {
  return (
    <p className="wake">
      <span>{t.say}</span>
      <kbd>«{wake}»</kbd>
      <span>{t.andAsk}</span>
    </p>
  );
}

function Lamp() {
  return <span className="lamp" aria-hidden="true" />;
}

function VoicePanel({ voice, coach, queue }: { voice: Voice; coach: Character; queue: Queued[] }) {
  if (voice.here) {
    const air = airState(queue, coach);
    return (
      <section className="voice on" aria-label={t.voiceChannel}>
        <div className="air-h">
          <span className="air">
            <Lamp />
            {t.onAir}
          </span>
          <span className="chan">
            <Mic size={14} />
            {voice.channel.name}
          </span>
        </div>
        <div className="air-who">
          <Meter bars={10} live={air.live} />
          <p className="state" aria-live="polite">
            {air.text}
          </p>
        </div>
        <Wake wake={coach.wake} />
      </section>
    );
  }
  return (
    <section className="voice" aria-label={t.voiceChannel}>
      <div>
        <span className="lab">{t.voiceChannel}</span>
        <p className="big">{voiceLine(voice, coach)}</p>
      </div>
      {voice.channel.canJoin && (
        <button type="button" className="b b-red" disabled={voice.busy} onClick={voice.bring}>
          {t.bring(coach.name)}
          <Arrow size={20} />
        </button>
      )}
      {voice.refused && (
        <p className="state" role="alert">
          {voice.refused}
        </p>
      )}
    </section>
  );
}

function VoiceBar({ voice, coach, queue }: { voice: Voice; coach: Character; queue: Queued[] }) {
  if (voice.here) {
    const air = airState(queue, coach);
    return (
      <section className="vb on" aria-label={t.voiceChannel}>
        <span className="air">
          <Lamp />
          <span className="sr">{t.onAir}</span>
        </span>
        <p>
          <span className="state" aria-live="polite">
            {air.text}
          </span>
          <br />
          <span className="chan">{voice.channel.name}</span>
        </p>
        <span className="sp" />
        <Meter bars={8} live={air.live} />
        <kbd className="wake-k">«{coach.wake}»</kbd>
      </section>
    );
  }
  return (
    <section className="vb" aria-label={t.voiceChannel}>
      <Mic />
      <p>{voice.refused ?? voiceLine(voice, coach)}</p>
      <span className="sp" />
      {voice.channel.canJoin && (
        <button type="button" className="b b-red" disabled={voice.busy} onClick={voice.bring}>
          {t.bring(coach.name)}
        </button>
      )}
    </section>
  );
}

function VoiceSelect({ voice, onPick, label, className }: { voice: CoachVoice; onPick: (voice: CoachVoice) => void; label?: string; className?: string }) {
  return (
    <select className={className} aria-label={label} value={voice} onChange={(event) => onPick(event.target.value as CoachVoice)}>
      {voices.map((code) => (
        <option key={code} value={code}>
          {voiceNames[code][lang]}
        </option>
      ))}
    </select>
  );
}

type Trouble = { text: string; retry: () => void };

type Log = { history: Message[]; messages: Message[]; cards: Map<number, Card>; members: Member[]; rated: Map<number, Rating>; voice: CoachVoice; last: number; lastRung: number };

const logs = new Map<string, Log>();

function RunView({ sheet, arrive, onChanged }: { sheet: RunSheet; arrive: boolean; onChanged: () => void }) {
  const closed = sheet.closed;
  const [closing, setClosing] = useState<"ask" | "busy" | null>(null);
  const [reopening, setReopening] = useState(false);
  const [log] = useState(() => logs.get(sheet.id));
  const [history, setHistory] = useState<Message[]>(log?.history ?? []);
  const [messages, setMessages] = useState<Message[]>(log?.messages ?? []);
  const [cards, setCards] = useState<Map<number, Card>>(log?.cards ?? new Map());
  const [members, setMembers] = useState<Member[]>(log?.members ?? sheet.members);
  const [loaded, setLoaded] = useState(log !== undefined);
  const [lost, setLost] = useState(false);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [road, setRoad] = useState<Roadmap | null>(null);
  const [roadOpen, setRoadOpen] = useState(false);
  const roadMark = useRef<string | null>(null);
  const fresh = useFresh(road);
  const lastOk = useRef(Date.now());
  const [settled, setSettled] = useState(log !== undefined);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Message | null>(null);
  const [airing, setAiring] = useState<{ text: string; at: string } | null>(null);
  const [trouble, setTrouble] = useState<Trouble | null>(null);
  const [revising, setRevising] = useState(false);
  const [rated, setRated] = useState<Map<number, Rating>>(log?.rated ?? new Map());
  const [voiceChoice, setVoiceChoice] = useState<CoachVoice>(log?.voice ?? sheet.voice);
  const choosing = useRef(0);
  const coach = characterOf(voiceChoice);
  const last = useRef(log?.last ?? 0);
  const lastRung = useRef(log?.lastRung ?? 0);
  const rows = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const polling = useRef(0);
  const name = sheet.map.name[lang];
  const title = useFit<HTMLHeadingElement>(name);
  const voice = useVoice(sheet.id, coach.name, Boolean(closed));

  const poll = useCallback(async () => {
    polling.current++;
    try {
      const reply = await fetchTranscript(sheet.id, last.current, lastRung.current);
      learn([...reply.members, ...reply.messages]);
      setMembers(reply.members);
      if (choosing.current === 0) setVoiceChoice(reply.voice);
      if (reply.history.length) setHistory(reply.history);
      setLoaded(true);
      setQueue(reply.queue);
      if (reply.closed !== Boolean(closed)) onChanged();
      if (reply.roadmap !== roadMark.current) {
        roadMark.current = reply.roadmap;
        fetchRoadmap(sheet.id)
          .then(setRoad)
          .catch(() => {
            roadMark.current = null;
          });
      }
      lastOk.current = Date.now();
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
      else if (error instanceof Refused && error.status === 403) onChanged();
      else if (Date.now() - lastOk.current >= lostAfterMs) setLost(true);
    } finally {
      polling.current--;
    }
  }, [sheet.id, closed, onChanged]);

  useEffect(() => {
    void poll();
    const tick = () => document.hidden || polling.current > 0 || void poll();
    const timer = setInterval(tick, lost ? lostPollMs : pollMs);
    const onShow = () => document.hidden || polling.current > 0 || void poll();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [poll, lost]);

  useEffect(() => {
    const timer = setInterval(() => !document.hidden && Date.now() - lastOk.current >= lostAfterMs && setLost(true), 1000);
    const onShow = () => {
      if (!document.hidden) lastOk.current = Math.max(lastOk.current, Date.now() - pollMs);
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  useEffect(() => {
    if (loaded) logs.set(sheet.id, { history, messages, cards, members, rated, voice: voiceChoice, last: last.current, lastRung: lastRung.current });
  }, [sheet.id, loaded, history, messages, cards, members, rated, voiceChoice]);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => setSettled(true), 600);
    return () => clearTimeout(timer);
  }, [loaded]);

  const shown = [...history, ...messages, ...(pending ? [pending] : [])];
  const pinned = useMemo(() => {
    const threads = new Map<number, Card[]>();
    for (const card of [...cards.values()].sort((a, b) => a.id - b.id)) threads.set(card.thread, [...(threads.get(card.thread) ?? []), card]);
    const open = [...threads.values()].filter((thread) => thread.length && !thread[thread.length - 1]!.done && thread.some((card) => card.rungs.length));
    const newest = open.sort((a, b) => b[b.length - 1]!.id - a[a.length - 1]!.id)[0];
    return newest ? [newest] : [];
  }, [cards]);
  const pinnedThread = pinned[0]?.[0]?.thread ?? null;
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
    let busy = false;
    let said = "";
    return start({
      opened: () => {
        opened = true;
        void poll();
      },
      heard: (event) => {
        if (event.type === "failed") failed = true;
        if (event.type === "busy") busy = true;
        if (event.type !== "text") return;
        said += event.text;
        setAiring((current) => current && { ...current, text: said });
      },
    })
      .then(() => {
        if (busy) {
          unsent?.();
          setTrouble({ text: t.busyCoach(coach.name), retry });
        } else if (failed) setTrouble({ text: t.noAnswer(coach.name), retry });
      })
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        if (!opened) unsent?.();
        setTrouble({ text: opened ? t.noAnswer(coach.name) : t.notSent, retry });
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
      who: you?.who ?? null,
      live: you?.live ?? false,
      avatar: you?.avatar ?? null,
      you: true,
      text: revision ?? text,
      at: new Date().toISOString(),
      card: null,
      spoken: false,
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

  const pick = (next: CoachVoice) => {
    const before = voiceChoice;
    setVoiceChoice(next);
    choosing.current++;
    changeVoice(sheet.id, next)
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        setVoiceChoice(before);
        setTrouble({ text: t.notChanged, retry: () => pick(next) });
      })
      .finally(() => {
        choosing.current--;
      });
  };

  const close = () => {
    setClosing("busy");
    closeRun(sheet.id)
      .then(onChanged)
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        setClosing(null);
        setTrouble({ text: t.notClosed, retry: close });
      });
  };

  const reopen = () => {
    setReopening(true);
    reopenRun(sheet.id)
      .then(onChanged)
      .catch((error: unknown) => {
        if (error instanceof SignedOut) return signIn();
        setReopening(false);
        setTrouble({ text: t.notReopened, retry: reopen });
      });
  };

  const more = (card: number) => {
    if (airing !== null) return;
    void listen(
      (listener) => askMore(sheet.id, card, listener),
      () => more(card),
    );
  };

  const slip = (card: Card, from: string) => (
    <Slip card={card} pinned={!card.done && card.thread === pinnedThread} still={Boolean(closed)} name={from} language={sheet.language} art={sheet.map.art} busy={airing !== null} rating={rated.get(card.id) ?? card.rating} onMore={more} onRate={rate} />
  );
  const pinnedSlip = (thread: Card[]) => {
    const latest = thread[thread.length - 1]!;
    return (
      <PinnedSlip
        key={latest.thread}
        thread={thread}
        still={Boolean(closed)}
        name={coach.name}
        language={sheet.language}
        art={sheet.map.art}
        busy={airing !== null}
        rating={rated.get(latest.id) ?? latest.rating}
        onMore={more}
        onRate={rate}
      />
    );
  };
  const notice = trouble ?? (lost ? { text: t.failed, retry: () => void poll() } : null);

  return (
    <div className={arrive ? "runv arrive" : "runv"}>
      <aside className="rail">
        <div>
          <span className="lab">{t.yourRun}</span>
          <h2 ref={title} className="cond">
            {name}
          </h2>
          <p className="sub">{t.speaksIn(coach.name, sheet.language)}</p>
        </div>
        {!closed && (
          <label className="pick">
            <span className="lab">{t.voice}</span>
            <VoiceSelect voice={voiceChoice} onPick={pick} />
          </label>
        )}
        <div>
          <span className="lab">{t.inTheRun}</span>
          <ul className="mem">
            {members.map((member, index) => (
              <li key={index}>
                <PersonChip person={member} you={member.you} />
                {nameOf(member)}
                {member.you && <span className="y"> {t.you}</span>}
              </li>
            ))}
          </ul>
          <div className="acts">
            <CopyLink id={sheet.id} icon={false} />
            {!closed && (
              <button type="button" className="b close-b" onClick={() => setClosing("ask")}>
                <Shut />
                {t.closeShort}
              </button>
            )}
          </div>
        </div>
        <RoadmapPanel map={road} fresh={fresh} language={sheet.language} onOpen={() => setRoadOpen(true)} />
        {voice && !closed && <VoicePanel voice={voice} coach={coach} queue={queue} />}
      </aside>
      <div className="strip">
        <Chips members={members} />
        {!closed && <VoiceSelect voice={voiceChoice} onPick={pick} label={t.voice} className="pick-m" />}
        <span className="m">· {languageNames[sheet.language]}</span>
        <span className="sp" />
        <button type="button" className={fresh.size ? "ib rm-ib rm-ib-new" : "ib rm-ib"} aria-label={t.roadmap} onClick={() => setRoadOpen(true)}>
          <Route />
        </button>
        <CopyLink id={sheet.id} icon />
        {!closed && (
          <button type="button" className="ib ib-close" aria-label={t.closeAttempt} onClick={() => setClosing("ask")}>
            <Shut />
          </button>
        )}
      </div>
      {closing && <CloseDialog coach={coach.name} busy={closing === "busy"} onClose={close} onCancel={() => setClosing(null)} />}
      {roadOpen && <RoadmapSheet map={road} fresh={fresh} language={sheet.language} onClose={() => setRoadOpen(false)} />}
      {voice && !closed && <VoiceBar voice={voice} coach={coach} queue={queue} />}
      <section className="main">
        {pinned.length > 0 && (
          <section className="pins" aria-label={coachWords[sheet.language].pins}>
            {pinned.map(pinnedSlip)}
          </section>
        )}
        <div className={["rows", loaded && !settled && "arrive-all", notice && "rows-trouble"].filter(Boolean).join(" ")} ref={rows} onScroll={onScroll} aria-busy={!loaded}>
          {!loaded && <RowsSkeleton />}
          {loaded && !shown.length && airing === null && <p className="state quiet">{t.quiet}</p>}
          {shown.map((message, index) => (
            <Row
              key={message.id}
              message={message}
              card={message.card === null ? undefined : cards.get(message.card)}
              old={index < shown.length - freshRows}
              coach={coach.name}
              slip={slip}
            />
          ))}
          {airing !== null && <Transmitting text={airing.text} at={airing.at} name={coach.name} language={sheet.language} />}
        </div>
        {!closed && <Queue queue={queue} coach={coach.name} />}
        {closed ? (
          <>
            {notice && (
              <div className="trouble" role="alert">
                <p className="state">{notice.text}</p>
                <button type="button" className="b b-ghost" onClick={notice.retry}>
                  {t.retry}
                </button>
              </div>
            )}
            <ClosedBar closed={closed} canReopen={sheet.wasMember} busy={reopening} onReopen={reopen} />
          </>
        ) : (
        <form className={revising ? "cmp cmp-rev" : "cmp"} onSubmit={send}>
          <div className="over">
            {notice && (
              <div className="trouble" role="alert">
                <p className="state">{notice.text}</p>
                <button type="button" className="b b-ghost" onClick={notice.retry} disabled={airing !== null}>
                  {t.retry}
                </button>
              </div>
            )}
            {revising && <p className="mode">{t.revisionMode}</p>}
          </div>
          <div className="cmp-in">
            <input
              className="field"
              aria-label={revising ? t.revision : t.messageFor(coach.name)}
              placeholder={revising ? t.commentOnCoaching : t.writeTo(coach.name)}
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
        )}
      </section>
      <RoadmapColumn map={road} fresh={fresh} language={sheet.language} />
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
  return state.sheet.you || state.sheet.closed ? <RunView key={state.sheet.closed?.at ?? "open"} sheet={state.sheet} arrive={!atOnce} onChanged={retry} /> : <JoinView sheet={state.sheet} arrive={!atOnce} onJoined={retry} />;
}
