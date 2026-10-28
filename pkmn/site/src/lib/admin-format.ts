import { locale } from "../../shared/i18n";

const sizeUnits = ["B", "KB", "MB", "GB"];

export function formatSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < sizeUnits.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${sizeUnits[unit]}`;
}

export function joinedOn(iso: string): string {
  return new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" });
}
