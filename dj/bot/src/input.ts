import { musicSearchUrl, searchSongs } from "./music.ts";

export type Item = { query: string; title?: string; artist?: string | null; artwork?: string | null; durationMs?: number };

const TICKET_LIFETIME_MS = 60_000;
const MAX_TRACKS = 200;

type SpotifyEntity = { title?: string; name?: string; subtitle?: string; artists?: { name: string }[]; trackList?: { title: string; subtitle: string }[] };

const search = (artist: string, title: string): Item => ({ query: musicSearchUrl(`${artist} ${title}`), title, artist });

async function spotify(kind: string, id: string): Promise<Item[]> {
  const page = await fetch(`https://open.spotify.com/embed/${kind}/${id}`, { headers: { "user-agent": "Mozilla/5.0", "accept-language": "en" } });
  const data = (await page.text()).match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)?.[1];
  if (!data) return [];
  const entity = (JSON.parse(data) as { props?: { pageProps?: { state?: { data?: { entity?: SpotifyEntity } } } } }).props?.pageProps?.state?.data?.entity;
  if (!entity) return [];
  if (entity.trackList?.length) return entity.trackList.slice(0, MAX_TRACKS).map((track) => search(track.subtitle.replace(/ /g, " "), track.title));
  const artist = entity.artists?.map((entry) => entry.name).join(" ") ?? entity.subtitle ?? "";
  const title = entity.title ?? entity.name;
  return title ? [search(artist, title)] : [];
}

export async function resolveInput(input: string, expand: (url: string) => Promise<{ title: string; url: string }[]>): Promise<Item[]> {
  const text = input.trim();
  const spotifyMatch = text.match(/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist)\/([A-Za-z0-9]+)/);
  if (spotifyMatch) return spotify(spotifyMatch[1]!, spotifyMatch[2]!);
  if (!/^https?:\/\//.test(text)) {
    if (!text) return [];
    const top = (await searchSongs(text, 1).catch((error: Error) => (console.error("music search", error.message), [])))[0];
    return [top ? { query: top.url, title: top.title, artist: top.artist, artwork: top.artwork, durationMs: top.durationMs } : { query: musicSearchUrl(text), title: text }];
  }
  if (/[?&]list=/.test(text) && !/[?&]list=RD/.test(text)) {
    const tracks = await expand(text);
    return tracks.slice(0, MAX_TRACKS).map((track) => ({ query: track.url, title: track.title }));
  }
  return [{ query: text, title: text }];
}

const hmac = async (message: string, secret: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export async function signTicket(secret: string): Promise<string> {
  const expires = String(Date.now() + TICKET_LIFETIME_MS);
  return `${expires}.${await hmac(expires, secret)}`;
}

export async function verifyTicket(ticket: string, secret: string): Promise<boolean> {
  const [expires, signature] = ticket.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return (await hmac(expires, secret)) === signature;
}
