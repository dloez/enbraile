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
  openRuns: "Open runs",
  noOpenRuns: "No open runs",
  someOpenRuns: (count: number) => `${count} open runs`,
  noneOnMap: "None open on this map.",
  noMaps: "No maps on file yet.",
  noSuchMap: "No such map on file.",
  testMap: "Test map",
  language: "Language",
  failed: "Can't reach the site right now.",
  retry: "Retry",
  yourRun: "Your run",
  runOf: (name: string) => `${name}’s run`,
  startRun: "Start a run",
  startARun: "Start a run",
  join: "Join",
  youreIn: "you’re in it",
  youreInIt: "You’re in it",
  cariSpeaks: "Cari speaks",
  cariSpeaksIn: { es: "Cari speaks Spanish", en: "Cari speaks English" } as Record<Language, string>,
  leaveOnStart: "Starting a run takes you out of yours on ",
  leaveOnEither: "Joining or starting a run takes you out of yours on ",
  leaveOnJoin: "Joining takes you out of your run on ",
  leaveAfter: ".",
  inTheRun: "In the run",
  startedIt: "started it",
  joinTheRun: "Join the run",
  otherRuns: "See this map’s other runs",
  you: "you",
  copyLink: "Copy link",
  copyRunLink: "Copy the run’s link",
  copied: "Link copied",
  notCopied: "Couldn't copy",
  messageForCari: "Message to Cari",
  writeToCari: "Write to Cari…",
  send: "Send",
  noSuchRun: "No such run on file.",
  receiving: "Receiving…",
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
  openRuns: "Partidas abiertas",
  noOpenRuns: "Sin partidas abiertas",
  someOpenRuns: (count: number) => `${count} partidas abiertas`,
  noneOnMap: "Ninguna abierta en este mapa.",
  noMaps: "Aún no hay mapas archivados.",
  noSuchMap: "No hay ningún mapa así archivado.",
  testMap: "Mapa de prueba",
  language: "Idioma",
  failed: "Ahora mismo no se puede llegar al sitio.",
  retry: "Reintentar",
  yourRun: "Tu partida",
  runOf: (name: string) => `Partida de ${name}`,
  startRun: "Empezar partida",
  startARun: "Empezar una partida",
  join: "Unirse",
  youreIn: "estás dentro",
  youreInIt: "Estás dentro",
  cariSpeaks: "Cari habla",
  cariSpeaksIn: { es: "Cari habla español", en: "Cari habla inglés" },
  leaveOnStart: "Al empezarla sales de tu partida en ",
  leaveOnEither: "Al unirte o empezar una, sales de tu partida en ",
  leaveOnJoin: "Al unirte sales de tu partida en ",
  leaveAfter: ".",
  inTheRun: "En la partida",
  startedIt: "la empezó",
  joinTheRun: "Unirse a la partida",
  otherRuns: "Ver las otras partidas de este mapa",
  you: "tú",
  copyLink: "Copiar enlace",
  copyRunLink: "Copiar el enlace de la partida",
  copied: "Enlace copiado",
  notCopied: "No se ha podido copiar",
  messageForCari: "Mensaje para Cari",
  writeToCari: "Escribe a Cari…",
  send: "Enviar",
  noSuchRun: "No hay ninguna partida así archivada.",
  receiving: "Recibiendo…",
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

export const languageNames: Record<Language, string> = { es: "Español", en: "English" };
