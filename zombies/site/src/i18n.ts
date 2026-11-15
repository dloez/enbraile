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
};

export const t = lang === "es" ? es : en;

document.documentElement.lang = lang;
