import type { Language } from "../shared/bundle";

function cookieLang(): Language | undefined {
  return document.cookie.match(/(?:^|; )lang=(en|es)/)?.[1] as Language | undefined;
}

export const lang: Language = cookieLang() ?? (navigator.language.toLowerCase().startsWith("es") ? "es" : "en");

export function switchLang(): void {
  document.cookie = `lang=${lang === "es" ? "en" : "es"}; path=/; max-age=31536000; samesite=lax; secure`;
  location.reload();
}

const en = {
  maps: "Maps",
  onFile: (count: number) => `${count} ${count === 1 ? "map" : "maps"} on file`,
  attempts: "Attempts",
  noAttempts: "No attempts yet",
  attemptsLine: (count: number, beaten: number) => `${count} ${count === 1 ? "attempt" : "attempts"} · ${beaten === 0 ? "none" : beaten} beaten`,
  noneOnMap: "No attempts on this map yet.",
  playing: "Playing now",
  beaten: "Beaten",
  open: "Open",
  played: (when: string) => `played ${when}`,
  today: "today",
  yesterday: "yesterday",
  noMaps: "No maps on file yet.",
  noSuchMap: "No such map on file.",
  testMap: "Test map",
  language: "Language",
  failed: "Can't reach the site right now.",
  retry: "Retry",
  yourRun: "Your attempt",
  runOf: (name: string) => `${name}’s attempt`,
  startRun: "Start an attempt",
  startARun: "Start an attempt",
  join: "Join",
  youreIn: "you’re in it",
  youreInIt: "You’re in it",
  cariSpeaks: "Cari speaks",
  cariSpeaksIn: { es: "Cari speaks Spanish", en: "Cari speaks English" } as Record<Language, string>,
  leaveOnStart: "Starting an attempt takes you out of yours on ",
  leaveOnEither: "Joining or starting an attempt takes you out of yours on ",
  leaveOnJoin: "Joining takes you out of your attempt on ",
  leaveAfter: ".",
  inTheRun: "In the attempt",
  startedIt: "started it",
  joinTheRun: "Join the attempt",
  otherRuns: "See this map’s other attempts",
  you: "you",
  copyLink: "Copy link",
  copyRunLink: "Copy the attempt’s link",
  copied: "Link copied",
  notCopied: "Couldn't copy",
  messageForCari: "Message to Cari",
  writeToCari: "Write to Cari…",
  send: "Send",
  noSuchRun: "No such attempt on file.",
  quiet: "Nothing on the log yet.",
  notSent: "Your line didn't go through.",
  noAnswer: "Cari didn't answer.",
  revision: "Revision",
  revisionMode: "Revision mode · for Claude",
  commentOnCoaching: "Comment on the coaching…",
  re: (time: string | null) => (time ? `re: Cari ${time} · for Claude` : "for Claude"),
  notRated: "Your rating didn't go through.",
  planOf: (name: string) => `${name} plan`,
};

const es: typeof en = {
  maps: "Mapas",
  onFile: (count: number) => `${count} ${count === 1 ? "mapa" : "mapas"}`,
  attempts: "Intentos",
  noAttempts: "Aún sin intentos",
  attemptsLine: (count: number, beaten: number) =>
    `${count} ${count === 1 ? "intento" : "intentos"} · ${beaten === 0 ? "ninguno superado" : `${beaten} ${beaten === 1 ? "superado" : "superados"}`}`,
  noneOnMap: "Aún no hay intentos en este mapa.",
  playing: "Jugando ahora",
  beaten: "Superado",
  open: "Abrir",
  played: (when: string) => `jugado ${when}`,
  today: "hoy",
  yesterday: "ayer",
  noMaps: "Aún no hay mapas archivados.",
  noSuchMap: "No hay ningún mapa así archivado.",
  testMap: "Mapa de prueba",
  language: "Idioma",
  failed: "Ahora mismo no se puede llegar al sitio.",
  retry: "Reintentar",
  yourRun: "Tu intento",
  runOf: (name: string) => `Intento de ${name}`,
  startRun: "Empezar intento",
  startARun: "Empezar un intento",
  join: "Unirse",
  youreIn: "estás dentro",
  youreInIt: "Estás dentro",
  cariSpeaks: "Cari habla",
  cariSpeaksIn: { es: "Cari habla español", en: "Cari habla inglés" },
  leaveOnStart: "Al empezarlo sales de tu intento en ",
  leaveOnEither: "Al unirte o empezar uno, sales de tu intento en ",
  leaveOnJoin: "Al unirte sales de tu intento en ",
  leaveAfter: ".",
  inTheRun: "En el intento",
  startedIt: "la empezó",
  joinTheRun: "Unirse al intento",
  otherRuns: "Ver los otros intentos de este mapa",
  you: "tú",
  copyLink: "Copiar enlace",
  copyRunLink: "Copiar el enlace del intento",
  copied: "Enlace copiado",
  notCopied: "No se ha podido copiar",
  messageForCari: "Mensaje para Cari",
  writeToCari: "Escribe a Cari…",
  send: "Enviar",
  noSuchRun: "No hay ningún intento así archivado.",
  quiet: "Aún no hay nada en el registro.",
  notSent: "Tu mensaje no ha llegado.",
  noAnswer: "Cari no ha contestado.",
  revision: "Revisión",
  revisionMode: "Modo revisión · para Claude",
  commentOnCoaching: "Comenta el coaching…",
  re: (time: string | null) => (time ? `re: Cari ${time} · para Claude` : "para Claude"),
  notRated: "Tu valoración no ha llegado.",
  planOf: (name: string) => `Plano de ${name}`,
};

export const t = lang === "es" ? es : en;

document.documentElement.lang = lang;

export function playedAt(iso: string): string {
  const at = new Date(iso);
  const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((day(new Date()) - day(at)) / 86400000);
  const time = at.toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" });
  if (days === 0) return t.played(`${t.today}, ${time}`);
  if (days === 1) return t.played(t.yesterday);
  const date = at.toLocaleDateString(lang, { day: "numeric", month: "short", year: at.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  return t.played(lang === "es" ? `el ${date}` : date);
}

export const languageNames: Record<Language, string> = { es: "Español", en: "English" };
