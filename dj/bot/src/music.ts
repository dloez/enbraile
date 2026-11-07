export type Song = { videoId: string; url: string; title: string; artist: string; album: string | null; durationMs: number; artwork: string | null; plays: string | null };

type Run = { text: string; navigationEndpoint?: { browseEndpoint?: { browseEndpointContextSupportedConfigs?: { browseEndpointContextMusicConfig?: { pageType?: string } } } } };
type Column = { musicResponsiveListItemFlexColumnRenderer?: { text?: { runs?: Run[] } } };
type ListItem = {
  musicResponsiveListItemRenderer?: {
    flexColumns?: Column[];
    playlistItemData?: { videoId?: string };
    thumbnail?: { musicThumbnailRenderer?: { thumbnail?: { thumbnails?: { url: string }[] } } };
  };
};
type SearchResponse = { contents?: { tabbedSearchResultsRenderer?: { tabs?: { tabRenderer?: { content?: { sectionListRenderer?: { contents?: { musicShelfRenderer?: { contents?: ListItem[] } }[] } } } }[] } } };

const CLIENT = { clientName: "WEB_REMIX", clientVersion: "1.20251101.01.00", hl: "en", gl: "ES" };
const SONGS_ONLY = "EgWKAQIIAWoMEA4QChADEAQQCRAF";
const SEPARATOR = " • ";

export const musicSearchUrl = (text: string) => `https://music.youtube.com/search?q=${encodeURIComponent(text)}#songs`;

function clockToMs(text: string): number {
  return text.split(":").reduce((total, part) => total * 60 + Number(part), 0) * 1000;
}

function song(item: ListItem): Song | null {
  const renderer = item.musicResponsiveListItemRenderer;
  const videoId = renderer?.playlistItemData?.videoId;
  const columns = renderer?.flexColumns?.map((column) => column.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []) ?? [];
  const title = columns[0]?.map((run) => run.text).join("");
  if (!videoId || !title) return null;
  const groups: Run[][] = [[]];
  for (const run of columns[1] ?? []) {
    if (run.text === SEPARATOR) groups.push([]);
    else groups.at(-1)!.push(run);
  }
  const text = (group: Run[]) => group.map((run) => run.text).join("");
  const pageType = (group: Run[]) => group[0]?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
  const duration = groups.map(text).find((value) => /^\d+(:\d{2})+$/.test(value));
  const album = groups.slice(1).find((group) => pageType(group) === "MUSIC_PAGE_TYPE_ALBUM");
  const artwork = renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url ?? null;
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title,
    artist: text(groups[0] ?? []),
    album: album ? text(album) : null,
    durationMs: duration ? clockToMs(duration) : 0,
    artwork: artwork ? artwork.replace(/=w\d+-h\d+/, "=w544-h544") : null,
    plays: columns[2]?.map((run) => run.text).join("") || null,
  };
}

export async function searchSongs(query: string, limit = 10): Promise<Song[]> {
  const response = await fetch("https://music.youtube.com/youtubei/v1/search?prettyPrint=false", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0", origin: "https://music.youtube.com" },
    body: JSON.stringify({ context: { client: CLIENT }, query, params: SONGS_ONLY }),
  });
  if (!response.ok) throw new Error(`music search ${response.status}`);
  const data = (await response.json()) as SearchResponse;
  const sections = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
  return sections
    .flatMap((section) => section.musicShelfRenderer?.contents ?? [])
    .map(song)
    .filter((entry): entry is Song => entry !== null)
    .slice(0, limit);
}

type PanelVideo = { videoId?: string; title?: { runs?: Run[] }; longBylineText?: { runs?: Run[] }; lengthText?: { runs?: Run[] }; thumbnail?: { thumbnails?: { url: string }[] } };
type NextResponse = { contents?: { singleColumnMusicWatchNextResultsRenderer?: { tabbedRenderer?: { watchNextTabbedResultsRenderer?: { tabs?: { tabRenderer?: { content?: { musicQueueRenderer?: { content?: { playlistPanelRenderer?: { contents?: { playlistPanelVideoRenderer?: PanelVideo }[] } } } } } }[] } } } } };

export type Seed = { videoId: string; weight: number };

const RADIO_LENGTH = 50;

function panelSong(video: PanelVideo): Song | null {
  const title = video.title?.runs?.map((run) => run.text).join("");
  if (!video.videoId || !title) return null;
  const byline = (video.longBylineText?.runs ?? []).map((run) => run.text).join("").split(SEPARATOR);
  const length = video.lengthText?.runs?.[0]?.text;
  const artwork = video.thumbnail?.thumbnails?.at(-1)?.url ?? null;
  return {
    videoId: video.videoId,
    url: `https://www.youtube.com/watch?v=${video.videoId}`,
    title,
    artist: byline[0] ?? "",
    album: byline.length > 2 ? (byline[1] ?? null) : null,
    durationMs: length && /^\d+(:\d{2})+$/.test(length) ? clockToMs(length) : 0,
    artwork: artwork ? artwork.replace(/=w\d+-h\d+/, "=w544-h544") : null,
    plays: null,
  };
}

export async function songRadio(videoId: string): Promise<Song[]> {
  const response = await fetch("https://music.youtube.com/youtubei/v1/next?prettyPrint=false", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0", origin: "https://music.youtube.com" },
    body: JSON.stringify({ context: { client: CLIENT }, videoId, playlistId: `RDAMVM${videoId}`, isAudioOnly: true }),
  });
  if (!response.ok) throw new Error(`music radio ${response.status}`);
  const data = (await response.json()) as NextResponse;
  const tabs = data.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs ?? [];
  const items = tabs[0]?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents ?? [];
  return items.map((item) => (item.playlistPanelVideoRenderer ? panelSong(item.playlistPanelVideoRenderer) : null)).filter((entry): entry is Song => entry !== null);
}

export function artistNames(artist: string | null | undefined): string[] {
  return (artist ?? "")
    .toLowerCase()
    .split(/\s*(?:,|&|\band\b|\bx\b|\bfeat\.?|\bft\.?|\bwith\b)\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export async function sessionRadio(seeds: Seed[], played: Set<string>, avoidArtists: string[]): Promise<Song[]> {
  const radios = await Promise.all(seeds.map((seed) => songRadio(seed.videoId).catch((error: Error) => (console.error("radio", seed.videoId, error.message), []))));
  const scored = new Map<string, { song: Song; score: number }>();
  radios.forEach((radio, index) => {
    const weight = seeds[index]!.weight;
    radio.forEach((song, rank) => {
      if (played.has(song.videoId)) return;
      const entry = scored.get(song.videoId) ?? { song, score: 0 };
      entry.score += weight * (1 - rank / RADIO_LENGTH) ** 2;
      scored.set(song.videoId, entry);
    });
  });
  const avoid = new Set(avoidArtists);
  const ranked = [...scored.values()].sort((a, b) => b.score - a.score).map((entry) => entry.song);
  const fresh = ranked.filter((song) => !artistNames(song.artist).some((name) => avoid.has(name)));
  return fresh.length ? fresh : ranked;
}
