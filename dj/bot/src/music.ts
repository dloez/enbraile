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
