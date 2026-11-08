export type ArtistRef = { id: string; name: string };
export type Song = { videoId: string; url: string; title: string; artist: string; artists?: ArtistRef[]; album: string | null; durationMs: number; artwork: string | null; plays: string | null };

type Run = { text: string; navigationEndpoint?: { browseEndpoint?: { browseId?: string; browseEndpointContextSupportedConfigs?: { browseEndpointContextMusicConfig?: { pageType?: string } } } } };
type Column = { musicResponsiveListItemFlexColumnRenderer?: { text?: { runs?: Run[] } } };
type FixedColumn = { musicResponsiveListItemFixedColumnRenderer?: { text?: { runs?: Run[] } } };
type Thumbnails = { thumbnails?: { url: string }[] };
type ListItem = {
  musicResponsiveListItemRenderer?: {
    flexColumns?: Column[];
    fixedColumns?: FixedColumn[];
    navigationEndpoint?: Run["navigationEndpoint"];
    playlistItemData?: { videoId?: string };
    thumbnail?: { musicThumbnailRenderer?: { thumbnail?: { thumbnails?: { url: string }[] } } };
  };
};
type SearchResponse = { contents?: { tabbedSearchResultsRenderer?: { tabs?: { tabRenderer?: { content?: { sectionListRenderer?: { contents?: { musicShelfRenderer?: { contents?: ListItem[] } }[] } } } }[] } } };

const CLIENT = { clientName: "WEB_REMIX", clientVersion: "1.20251101.01.00", hl: "en", gl: "ES" };
const SONGS_ONLY = "EgWKAQIIAWoMEA4QChADEAQQCRAF";
const ARTISTS_ONLY = "EgWKAQIgAWoMEA4QChADEAQQCRAF";
const ARTIST_PAGE = "MUSIC_PAGE_TYPE_ARTIST";
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
  const artists = (groups[0] ?? []).flatMap((run) => {
    const endpoint = run.navigationEndpoint?.browseEndpoint;
    return endpoint?.browseId && pageType([run]) === ARTIST_PAGE ? [{ id: endpoint.browseId, name: run.text }] : [];
  });
  const album = groups.slice(1).find((group) => pageType(group) === "MUSIC_PAGE_TYPE_ALBUM");
  const artwork = renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url ?? null;
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title,
    artist: text(groups[0] ?? []),
    artists,
    album: album ? text(album) : null,
    durationMs: duration ? clockToMs(duration) : 0,
    artwork: artwork ? artwork.replace(/=w\d+-h\d+/, "=w544-h544") : null,
    plays: columns[2]?.map((run) => run.text).join("") || null,
  };
}

async function youtubeMusic<T>(endpoint: "search" | "browse", body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://music.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0", origin: "https://music.youtube.com" },
    body: JSON.stringify({ context: { client: CLIENT }, ...body }),
  });
  if (!response.ok) throw new Error(`music ${endpoint} ${response.status}`);
  return (await response.json()) as T;
}

async function searchItems(query: string, params: string): Promise<ListItem[]> {
  const data = await youtubeMusic<SearchResponse>("search", { query, params });
  const sections = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
  return sections.flatMap((section) => section.musicShelfRenderer?.contents ?? []);
}

export async function searchSongs(query: string, limit = 10): Promise<Song[]> {
  return (await searchItems(query, SONGS_ONLY))
    .map(song)
    .filter((entry): entry is Song => entry !== null)
    .slice(0, limit);
}

export type Artist = { id: string; name: string; avatar: string | null; audience: string | null };

const sized = (url: string | null | undefined, size: number) => (url ? url.replace(/=w\d+-h\d+/, `=w${size}-h${size}`) : null);
const runsText = (runs: Run[] | undefined) => (runs ?? []).map((run) => run.text).join("");

export async function searchArtists(query: string, limit = 3): Promise<Artist[]> {
  return (await searchItems(query, ARTISTS_ONLY))
    .flatMap((item) => {
      const renderer = item.musicResponsiveListItemRenderer;
      const id = renderer?.navigationEndpoint?.browseEndpoint?.browseId;
      const columns = renderer?.flexColumns?.map((column) => column.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []) ?? [];
      const name = runsText(columns[0]);
      if (!id || !name) return [];
      const audience = runsText(columns[1]).split(SEPARATOR).find((part) => /\d/.test(part)) ?? null;
      return [{ id, name, avatar: sized(renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url, 240), audience }];
    })
    .slice(0, limit);
}

export type Release = { id: string; title: string; year: string | null; kind: "album" | "single"; artwork: string | null };
export type ArtistPage = Artist & { banner: string | null; songs: Song[]; releases: Release[]; related: Artist[] };
export type Album = Release & { artist: string; songs: Song[] };

type TwoRow = { title?: { runs?: Run[] }; subtitle?: { runs?: Run[] }; navigationEndpoint?: Run["navigationEndpoint"]; thumbnailRenderer?: { musicThumbnailRenderer?: { thumbnail?: Thumbnails } } };
type Shelf = {
  musicShelfRenderer?: { title?: { runs?: Run[] }; contents?: ListItem[]; bottomEndpoint?: Run["navigationEndpoint"] };
  musicCarouselShelfRenderer?: { header?: { musicCarouselShelfBasicHeaderRenderer?: { title?: { runs?: Run[] } } }; contents?: { musicTwoRowItemRenderer?: TwoRow }[] };
  musicPlaylistShelfRenderer?: { contents?: ListItem[] };
  musicResponsiveHeaderRenderer?: { title?: { runs?: Run[] }; subtitle?: { runs?: Run[] }; straplineTextOne?: { runs?: Run[] }; thumbnail?: { musicThumbnailRenderer?: { thumbnail?: Thumbnails } } };
};
type Header = { title?: { runs?: Run[] }; monthlyListenerCount?: { runs?: Run[] }; subscriptionButton?: { subscribeButtonRenderer?: { subscriberCountText?: { runs?: Run[] } } }; thumbnail?: { musicThumbnailRenderer?: { thumbnail?: Thumbnails } }; foregroundThumbnail?: { musicThumbnailRenderer?: { thumbnail?: Thumbnails } } };
type BrowseResponse = {
  header?: { musicImmersiveHeaderRenderer?: Header; musicVisualHeaderRenderer?: Header };
  contents?: {
    singleColumnBrowseResultsRenderer?: { tabs?: { tabRenderer?: { content?: { sectionListRenderer?: { contents?: Shelf[] } } } }[] };
    twoColumnBrowseResultsRenderer?: { tabs?: { tabRenderer?: { content?: { sectionListRenderer?: { contents?: Shelf[] } } } }[]; secondaryContents?: { sectionListRenderer?: { contents?: Shelf[] } } };
  };
};

const ARTIST_PAGE_TTL_MS = 10 * 60_000;

function releaseOf(item: TwoRow, kind: Release["kind"]): Release | null {
  const id = item.navigationEndpoint?.browseEndpoint?.browseId;
  const title = runsText(item.title?.runs);
  if (!id || !title) return null;
  const subtitle = runsText(item.subtitle?.runs);
  return { id, title, year: subtitle.match(/\b(19|20)\d{2}\b/)?.[0] ?? null, kind, artwork: sized(item.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url, 544) };
}

function listSong(item: ListItem, fallback: { artist?: string; artists?: ArtistRef[]; album?: string; artwork?: string | null }): Song | null {
  const parsed = song(item);
  if (!parsed) return null;
  const renderer = item.musicResponsiveListItemRenderer;
  const columns = renderer?.flexColumns?.map((column) => column.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []) ?? [];
  const fixed = runsText(renderer?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs);
  const plays = columns.slice(1).map(runsText).find((value) => /plays?$/i.test(value)) ?? null;
  const album = columns.slice(2).find((runs) => runs[0]?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === "MUSIC_PAGE_TYPE_ALBUM");
  return {
    ...parsed,
    artist: parsed.artist || fallback.artist || "",
    artists: parsed.artists?.length ? parsed.artists : (fallback.artists ?? []),
    album: album ? runsText(album) : (fallback.album ?? null),
    durationMs: parsed.durationMs || (/^\d+(:\d{2})+$/.test(fixed) ? clockToMs(fixed) : 0),
    artwork: parsed.artwork ?? fallback.artwork ?? null,
    plays,
  };
}

async function loadArtist(id: string): Promise<ArtistPage> {
  const data = await youtubeMusic<BrowseResponse>("browse", { browseId: id });
  const header = data.header?.musicImmersiveHeaderRenderer ?? data.header?.musicVisualHeaderRenderer;
  const name = runsText(header?.title?.runs);
  if (!name) throw new Error("notFound");
  const shelves = data.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
  const self = [{ id, name }];
  const topShelf = shelves.find((shelf) => shelf.musicShelfRenderer)?.musicShelfRenderer;
  let songs = (topShelf?.contents ?? []).map((item) => listSong(item, { artist: name, artists: self })).filter((entry): entry is Song => entry !== null);
  const allSongs = topShelf?.bottomEndpoint?.browseEndpoint?.browseId;
  if (allSongs) {
    try {
      const list = await youtubeMusic<BrowseResponse>("browse", { browseId: allSongs });
      const items = list.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer?.contents ?? [];
      const more = items.map((item) => listSong(item, { artist: name, artists: self })).filter((entry): entry is Song => entry !== null);
      if (more.length > songs.length) songs = more;
    } catch (error) {
      console.error("artist songs", id, (error as Error).message);
    }
  }
  const releases: Release[] = [];
  const related: Artist[] = [];
  for (const shelf of shelves) {
    const carousel = shelf.musicCarouselShelfRenderer;
    if (!carousel) continue;
    const title = runsText(carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs).toLowerCase();
    const items = (carousel.contents ?? []).flatMap((entry) => (entry.musicTwoRowItemRenderer ? [entry.musicTwoRowItemRenderer] : []));
    if (title === "albums" || title.startsWith("singles")) {
      for (const item of items) {
        const release = releaseOf(item, title === "albums" ? "album" : "single");
        if (release) releases.push(release);
      }
    } else if (items.some((item) => item.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === ARTIST_PAGE)) {
      for (const item of items) {
        const artistId = item.navigationEndpoint?.browseEndpoint?.browseId;
        const artistName = runsText(item.title?.runs);
        if (artistId && artistName && artistId !== id) related.push({ id: artistId, name: artistName, avatar: sized(item.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url, 240), audience: runsText(item.subtitle?.runs) || null });
      }
    }
  }
  const banner = header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url ?? null;
  const avatar = header?.foregroundThumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url ?? null;
  const audience = runsText(header?.monthlyListenerCount?.runs) || (header?.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText?.runs ? `${runsText(header.subscriptionButton.subscribeButtonRenderer.subscriberCountText.runs)} subscribers` : null);
  return { id, name, avatar: sized(avatar, 240), audience, banner, songs, releases, related: related.slice(0, 10) };
}

function cache<T>(load: (id: string) => Promise<T>): (id: string) => Promise<T> {
  const entries = new Map<string, { at: number; value: Promise<T> }>();
  return (id) => {
    const entry = entries.get(id);
    if (entry && Date.now() - entry.at < ARTIST_PAGE_TTL_MS) return entry.value;
    const value = load(id);
    entries.set(id, { at: Date.now(), value });
    value.catch(() => entries.delete(id));
    if (entries.size > 100) entries.delete(entries.keys().next().value!);
    return value;
  };
}

export const artistPage = cache(loadArtist);

export async function artistByName(name: string): Promise<ArtistPage> {
  const [match] = await searchArtists(name, 1);
  if (!match) throw new Error("notFound");
  return artistPage(match.id);
}

async function loadAlbum(id: string): Promise<Album> {
  const data = await youtubeMusic<BrowseResponse>("browse", { browseId: id });
  const two = data.contents?.twoColumnBrowseResultsRenderer;
  const header = two?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicResponsiveHeaderRenderer;
  const title = runsText(header?.title?.runs);
  if (!title) throw new Error("notFound");
  const strapline = header?.straplineTextOne?.runs ?? [];
  const artist = runsText(strapline);
  const artists = strapline.flatMap((run) => (run.navigationEndpoint?.browseEndpoint?.browseId ? [{ id: run.navigationEndpoint.browseEndpoint.browseId, name: run.text }] : []));
  const subtitle = (header?.subtitle?.runs ?? []).map((run) => run.text).filter((part) => part !== SEPARATOR);
  const artwork = sized(header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url, 544);
  const items = two?.secondaryContents?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer?.contents ?? [];
  const songs = items.map((item) => listSong(item, { artist, artists, album: title, artwork })).filter((entry): entry is Song => entry !== null);
  return { id, title, year: subtitle.find((part) => /^\d{4}$/.test(part)) ?? null, kind: /album/i.test(subtitle[0] ?? "") ? "album" : "single", artwork, artist, songs };
}

export const album = cache(loadAlbum);

type PanelVideo = { videoId?: string; title?: { runs?: Run[] }; longBylineText?: { runs?: Run[] }; lengthText?: { runs?: Run[] }; thumbnail?: { thumbnails?: { url: string }[] } };
type NextResponse = { contents?: { singleColumnMusicWatchNextResultsRenderer?: { tabbedRenderer?: { watchNextTabbedResultsRenderer?: { tabs?: { tabRenderer?: { content?: { musicQueueRenderer?: { content?: { playlistPanelRenderer?: { contents?: { playlistPanelVideoRenderer?: PanelVideo }[] } } } } } }[] } } } } };

export type Seed = { videoId: string; weight: number };

const RADIO_LENGTH = 50;
const SHORTEST_SONG_MS = 90_000;

function panelSong(video: PanelVideo): Song | null {
  const title = video.title?.runs?.map((run) => run.text).join("");
  if (!video.videoId || !title) return null;
  const runs = video.longBylineText?.runs ?? [];
  const byline = runs.map((run) => run.text).join("").split(SEPARATOR);
  const cut = runs.findIndex((run) => run.text === SEPARATOR);
  const lead = cut < 0 ? runs : runs.slice(0, cut);
  const artists = lead.flatMap((run) => {
    const endpoint = run.navigationEndpoint?.browseEndpoint;
    return endpoint?.browseId && endpoint.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === ARTIST_PAGE ? [{ id: endpoint.browseId, name: run.text }] : [];
  });
  const length = video.lengthText?.runs?.[0]?.text;
  const artwork = video.thumbnail?.thumbnails?.at(-1)?.url ?? null;
  return {
    videoId: video.videoId,
    url: `https://www.youtube.com/watch?v=${video.videoId}`,
    title,
    artist: byline[0] ?? "",
    artists,
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
      if (played.has(song.videoId) || (song.durationMs > 0 && song.durationMs < SHORTEST_SONG_MS)) return;
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
