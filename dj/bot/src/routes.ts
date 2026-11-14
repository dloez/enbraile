import { guild, type Route, ticketFor } from "../../../home/bot/src/sdk.ts";
import { accessOf, enqueueInput, voiceChannel, voiceOf } from "./discord.ts";
import { resolveInput } from "./input.ts";
import { album, albumOf, artistByName, artistPage, searchArtists, searchSongs } from "./music.ts";
import { warm } from "./player.ts";
import * as session from "./session.ts";

export const route: Route = async (method, path, params, input, userId) => {
  const id = String(input.id ?? "");
  const denied: [unknown, number] = [{ error: "forbidden" }, 403];
  const access = await accessOf(userId);
  if (path === "access") return [access];
  if (!access.member) return denied;
  if (path === "settings") {
    if (!access.canManage) return denied;
    if (method === "POST") session.setSettings({ djRoleId: (input.djRoleId as string | null) ?? null });
    const server = await guild();
    const roles = server.roles.cache.size ? server.roles.cache : await server.roles.fetch();
    return [{ ...session.settings(), roles: [...roles.values()].filter((role) => role.id !== role.guild.id && !role.managed).sort((a, b) => b.position - a.position).map((role) => ({ id: role.id, name: role.name })) }];
  }
  if (!access.canPlay) return denied;
  switch (path) {
    case "state":
      return [session.view()];
    case "ticket":
      return [await ticketFor("dj", userId)];
    case "command":
      await session.command(input.command as session.Command);
      return [session.view()];
    case "enqueue": {
      const voice = await voiceChannel(userId);
      const channelId = "error" in voice ? session.view().channelId : voice.channelId;
      if (!channelId) return ["error" in voice ? voice : { error: "notInVoice" }, 409];
      const items = input.items as session.QueueItem[] | undefined;
      if (items) return [await session.enqueue(channelId, items, userId)];
      const outcome = await enqueueInput(String(input.input), channelId, userId);
      return outcome ? [outcome.result] : [{ error: "noResults" }, 422];
    }
    case "search": {
      const query = (params.get("q") ?? "").trim().slice(0, 200);
      if (!query) return [[]];
      try {
        return [await searchSongs(query)];
      } catch (error) {
        console.error("music search", (error as Error).message);
        return [{ error: "searchFailed" }, 502];
      }
    }
    case "artists": {
      const query = (params.get("q") ?? "").trim().slice(0, 200);
      if (!query) return [[]];
      try {
        return [await searchArtists(query)];
      } catch (error) {
        console.error("artist search", (error as Error).message);
        return [{ error: "searchFailed" }, 502];
      }
    }
    case "artist": {
      const artistId = params.get("id") ?? "";
      const name = (params.get("name") ?? "").trim().slice(0, 200);
      try {
        if (/^UC[\w-]{22}$/.test(artistId)) return [await artistPage(artistId)];
        if (name) return [await artistByName(name)];
        return [{ error: "notFound" }, 404];
      } catch (error) {
        console.error("artist", artistId || name, (error as Error).message);
        return [{ error: "artistFailed" }, 502];
      }
    }
    case "album": {
      const albumId = params.get("id") ?? "";
      const video = params.get("video") ?? "";
      const name = (params.get("name") ?? "").trim().slice(0, 300) || null;
      const artist = (params.get("artist") ?? "").trim().slice(0, 300) || null;
      try {
        if (/^MPRE[\w-]+$/.test(albumId)) return [await album(albumId)];
        if (/^[\w-]{11}$/.test(video) || name) return [await albumOf(/^[\w-]{11}$/.test(video) ? video : null, name, artist)];
        return [{ error: "notFound" }, 404];
      } catch (error) {
        if ((error as Error).message === "notFound") return [{ error: "albumNotFound" }, 404];
        console.error("album", albumId || video || name, (error as Error).message);
        return [{ error: "artistFailed" }, 502];
      }
    }
    case "warm": {
      const query = String(input.query ?? "");
      if (/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(query)) warm(query);
      return [{ ok: true }];
    }
    case "suggestions":
      try {
        return [await session.suggestions(userId)];
      } catch (error) {
        console.error("suggestions", (error as Error).message);
        return [[]];
      }
    case "playlist/suggestions":
      try {
        const songs = await session.playlistSuggestions(params.get("id") ?? "", userId);
        return songs ? [songs] : [{ error: "notFound" }, 404];
      } catch (error) {
        console.error("playlist suggestions", (error as Error).message);
        return [[]];
      }
    case "voice":
      return [{ voice: await voiceOf(userId) }];
    case "history":
      return [session.history()];
    case "sessions":
      return [session.sessions()];
    case "session/tracks":
      return [session.sessionTracks(Number(params.get("id")))];
    case "playlist/from-session": {
      const made = session.playlistFromSession(Number(input.sessionId), String(input.name ?? ""), userId, String(input.ownerName ?? ""), input.visibility as session.Visibility);
      return made ? [made] : [{ error: "noResults" }, 422];
    }
    case "playlist/merge-session": {
      const merged = session.mergeSession(id, userId, Number(input.sessionId));
      return merged ? [merged] : denied;
    }
    case "playlists":
      if (method === "POST") return [{ id: session.createPlaylist(String(input.name), userId, String(input.ownerName ?? ""), input.visibility as session.Visibility) }];
      return [session.playlists(userId)];
    case "playlist/tracks": {
      const tracks = session.playlistTracks(params.get("id") ?? "", userId);
      return tracks ? [tracks] : [{ error: "notFound" }, 404];
    }
    case "playlist/visibility":
      return session.setPlaylistVisibility(id, userId, input.visibility as session.Visibility) ? [{ ok: true }] : denied;
    case "playlist/rename":
      return session.renamePlaylist(id, userId, String(input.name)) ? [{ ok: true }] : denied;
    case "playlist/delete":
      return session.deletePlaylist(id, userId) ? [{ ok: true }] : denied;
    case "playlist/add": {
      const items = (input.items as session.QueueItem[] | undefined) ?? (await resolveInput(String(input.input), session.expand));
      const named = items.map((item) => ({ query: item.query, title: item.title ?? session.displayName(item.query), artist: item.artist ?? null, artwork: item.artwork ?? null, durationMs: item.durationMs ?? 0 }));
      return session.addToPlaylist(id, userId, named) ? [{ added: named.length }] : denied;
    }
    case "playlist/remove":
      return session.removeFromPlaylist(id, userId, String(input.trackId)) ? [{ ok: true }] : denied;
    case "playlist/move":
      return session.movePlaylistTrack(id, userId, String(input.trackId), Number(input.to)) ? [{ ok: true }] : denied;
  }
  return [{ error: "notFound" }, 404];
};
