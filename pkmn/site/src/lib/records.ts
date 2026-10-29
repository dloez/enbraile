import { type Lang, locale } from "../../shared/i18n";

export function playTime(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

export function money(amount: number | null): string {
  return amount === null ? "—" : `₽${amount.toLocaleString(locale)}`;
}

export function ordinal(n: number, lang: Lang): string {
  if (lang === "es") return `${n}.º`;
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}
