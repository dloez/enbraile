import { locale } from "../../shared/i18n";

export function playTime(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

export function money(amount: number | null): string {
  return amount === null ? "—" : `₽${amount.toLocaleString(locale)}`;
}
