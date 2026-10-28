export const LANGS = ["en", "es"] as const;

export type Lang = (typeof LANGS)[number];

export const LANG_COOKIE = "lang";

export function parseLang(value: string | null | undefined): Lang | null {
  return value === "en" || value === "es" ? value : null;
}

export function preferredLang(cookie: string | null | undefined, accepted: string | null | undefined): Lang {
  const saved = parseLang(cookie?.match(/(?:^|;\s*)lang=([^;]*)/)?.[1]);
  if (saved) return saved;
  return accepted?.trim().toLowerCase().startsWith("es") ? "es" : "en";
}

const host = globalThis as { document?: { cookie: string }; navigator?: { language: string } };

export const lang: Lang = host.document ? preferredLang(host.document.cookie, host.navigator?.language) : "en";

export const locale = lang === "es" ? "es-ES" : "en-GB";

export type Messages<E> = { en: E; es: NoInfer<E> };

export function messages<E>(m: Messages<E>): E {
  return m[lang];
}
