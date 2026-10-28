import { LANG_COOKIE, type Lang } from "../../shared/i18n";

export function setLang(next: Lang) {
  document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}
