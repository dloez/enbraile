import { prefetch } from "@/lib/api";
import { loadDexText } from "@/i18n/dex";
import { lang } from "../shared/i18n";

document.documentElement.lang = lang;

prefetch("/auth/get-session");
prefetch("/series");
prefetch("/series/owed");

await loadDexText();
await import("./boot");
