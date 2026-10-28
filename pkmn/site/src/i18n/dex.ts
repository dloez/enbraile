import { setDexText } from "../../shared/dex-text";
import { lang } from "../../shared/i18n";

export async function loadDexText() {
  if (lang !== "es") return;
  const [names, descs] = await Promise.all([import("./es/names.json"), import("./es/descs.json")]);
  setDexText(names.default, descs.default);
}
