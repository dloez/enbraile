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
  runs: "Runs",
  noRuns: "No runs yet",
  noMaps: "No maps published yet",
  testMap: "Test map",
  language: "Language",
  failed: "Can't reach the site right now.",
  retry: "Retry",
};

const es: typeof en = {
  maps: "Mapas",
  runs: "Partidas",
  noRuns: "Aún no hay partidas",
  noMaps: "Aún no hay mapas publicados",
  testMap: "Mapa de prueba",
  language: "Idioma",
  failed: "Ahora mismo no se puede llegar al sitio.",
  retry: "Reintentar",
};

export const t = lang === "es" ? es : en;

document.documentElement.lang = lang;
