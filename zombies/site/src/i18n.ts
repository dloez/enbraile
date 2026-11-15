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
  radioLog: "Radio log",
  maps: "Maps",
  onFile: (count: number) => `${count} ${count === 1 ? "map" : "maps"} on file`,
  plan: "Plan",
  map: "Map",
  openRuns: "Open runs",
  noneOpen: "— none open —",
  endOfFile: "End of file",
  noMaps: "— no maps on file yet —",
  testMap: "Test map",
  language: "Language",
  failed: "Can't reach the site right now.",
  retry: "Retry",
  yourRun: "Your run",
  backToRun: "Back to the run",
  lang: (code: string) => `Lang. ${code}`,
  startRun: "Start a run",
  join: "Join",
  youreIn: "You're in it",
  newRun: "New run",
  close: "Close",
  cariSpeaks: "Cari speaks",
  note: "Note",
  leaveBefore: "You leave your run on ",
  leaveAfter: ".",
  cancel: "Cancel",
  joinThisRun: "Join this run",
  runSheet: "Run sheet",
  startedBy: "Started by",
  inTheRun: "In the run",
  joinTheRun: "Join the run",
  runLang: (code: string) => `Run · Lang. ${code}`,
  you: "you",
  time: "Time",
  from: "From",
  transcriptOf: (name: string) => `Transcript · ${name}`,
  messageForCari: "Message for Cari",
  writeToCari: "Write to Cari…",
  send: "Send",
  noSuchRun: "— no such run on file —",
};

const es: typeof en = {
  radioLog: "Registro de radio",
  maps: "Mapas",
  onFile: (count: number) => `${count} ${count === 1 ? "mapa archivado" : "mapas archivados"}`,
  plan: "Plano",
  map: "Mapa",
  openRuns: "Partidas abiertas",
  noneOpen: "— ninguna abierta —",
  endOfFile: "Fin del archivo",
  noMaps: "— aún no hay mapas archivados —",
  testMap: "Mapa de prueba",
  language: "Idioma",
  failed: "Ahora mismo no se puede llegar al sitio.",
  retry: "Reintentar",
  yourRun: "Tu partida",
  backToRun: "Volver a la partida",
  lang: (code: string) => `Idioma ${code}`,
  startRun: "Empezar partida",
  join: "Unirse",
  youreIn: "Estás dentro",
  newRun: "Nueva partida",
  close: "Cerrar",
  cariSpeaks: "Cari habla",
  note: "Aviso",
  leaveBefore: "Dejas tu partida en ",
  leaveAfter: ".",
  cancel: "Cancelar",
  joinThisRun: "Unirse a esta partida",
  runSheet: "Hoja de partida",
  startedBy: "Empezada por",
  inTheRun: "En la partida",
  joinTheRun: "Unirse a la partida",
  runLang: (code: string) => `Partida · Idioma ${code}`,
  you: "tú",
  time: "Hora",
  from: "De",
  transcriptOf: (name: string) => `Transcripción · ${name}`,
  messageForCari: "Mensaje para Cari",
  writeToCari: "Escribe a Cari…",
  send: "Enviar",
  noSuchRun: "— no hay ninguna partida así archivada —",
};

export const t = lang === "es" ? es : en;

document.documentElement.lang = lang;

export const languageNames: Record<Language, string> = { es: "Español", en: "English" };
