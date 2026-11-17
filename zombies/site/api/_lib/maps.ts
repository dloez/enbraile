import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Bundle, PublishedMap } from "../../shared/bundle.js";
import { db } from "./db.js";
import type { ImageType } from "../../shared/image.js";
import { audits, bundleVersions, callLines, coachCalls, coachQueue, deliveries, feedback, gaps, headsUpsGiven, hintCards, mapImages, maps, messages, runHistory, runKnowledge, runMembers, runSteps, runs } from "./schema.js";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export async function storeVersion(bundle: Bundle, publishedBy: "claude"): Promise<{ version: number; created: boolean }> {
  const digest = createHash("sha256").update(canonical(bundle)).digest("hex");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${bundle.game}/${bundle.map}`}))`);
    const [current] = await tx.select().from(maps).where(and(eq(maps.game, bundle.game), eq(maps.map, bundle.map)));
    if (current) {
      const [latest] = await tx
        .select({ digest: bundleVersions.digest })
        .from(bundleVersions)
        .where(and(eq(bundleVersions.game, bundle.game), eq(bundleVersions.map, bundle.map), eq(bundleVersions.version, current.latestVersion)));
      if (latest?.digest === digest) return { version: current.latestVersion, created: false };
    }
    const version = (current?.latestVersion ?? 0) + 1;
    await tx.insert(bundleVersions).values({ game: bundle.game, map: bundle.map, version, digest, bundle, publishedBy });
    await tx
      .insert(maps)
      .values({ game: bundle.game, map: bundle.map, latestVersion: version })
      .onConflictDoUpdate({ target: [maps.game, maps.map], set: { latestVersion: version, updatedAt: new Date() } });
    return { version, created: true };
  });
}

export async function publishedMaps(): Promise<PublishedMap[]> {
  const rows = await db
    .select({
      game: maps.game,
      map: maps.map,
      version: maps.latestVersion,
      name: sql<PublishedMap["name"]>`${bundleVersions.bundle}->'name'`,
      test: sql<boolean>`coalesce((${bundleVersions.bundle}->>'test')::boolean, false)`,
      art: sql<PublishedMap["art"]>`${bundleVersions.bundle}->>'art'`,
      image: sql<PublishedMap["image"]>`case when ${bundleVersions.bundle} ? 'image' then jsonb_build_object('digest', ${bundleVersions.bundle}->'image'->'digest', 'width', ${bundleVersions.bundle}->'image'->'width', 'height', ${bundleVersions.bundle}->'image'->'height') end`,
    })
    .from(maps)
    .innerJoin(bundleVersions, and(eq(bundleVersions.game, maps.game), eq(bundleVersions.map, maps.map), eq(bundleVersions.version, maps.latestVersion)))
    .orderBy(maps.createdAt);
  return rows;
}

export async function storeImage(digest: string, type: ImageType, bytes: Buffer): Promise<boolean> {
  const stored = await db.insert(mapImages).values({ digest, type, bytes }).onConflictDoNothing().returning({ digest: mapImages.digest });
  return stored.length > 0;
}

export async function hasImage(digest: string): Promise<boolean> {
  const [row] = await db.select({ digest: mapImages.digest }).from(mapImages).where(eq(mapImages.digest, digest));
  return Boolean(row);
}

export async function imageOf(digest: string): Promise<{ type: ImageType; bytes: Buffer } | undefined> {
  const [row] = await db.select({ type: mapImages.type, bytes: mapImages.bytes }).from(mapImages).where(eq(mapImages.digest, digest));
  return row;
}

const runTables = [coachQueue, feedback, audits, gaps, deliveries, hintCards, headsUpsGiven, runSteps, coachCalls, runKnowledge, callLines, runHistory, messages, runMembers];

export async function deleteRun(id: string): Promise<{ game: string; map: string; lines: number } | undefined> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`coach/${id}`}))`);
    const [run] = await tx.select({ game: runs.game, map: runs.map }).from(runs).where(eq(runs.id, id));
    if (!run) return undefined;
    const lines = await tx.select({ id: messages.id }).from(messages).where(eq(messages.runId, id));
    for (const table of runTables) await tx.delete(table).where(eq(table.runId, id));
    await tx.delete(runs).where(eq(runs.id, id));
    return { game: run.game, map: run.map, lines: lines.length };
  });
}

export async function deleteMap(game: string, map: string): Promise<{ versions: number; runs: number; images: number } | undefined> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${game}/${map}`}))`);
    const [current] = await tx.select().from(maps).where(and(eq(maps.game, game), eq(maps.map, map)));
    if (!current) return undefined;
    const ids = (await tx.select({ id: runs.id }).from(runs).where(and(eq(runs.game, game), eq(runs.map, map)))).map((row) => row.id);
    if (ids.length) {
      for (const table of runTables) await tx.delete(table).where(inArray(table.runId, ids));
      await tx.delete(runs).where(inArray(runs.id, ids));
    }
    const versions = await tx
      .delete(bundleVersions)
      .where(and(eq(bundleVersions.game, game), eq(bundleVersions.map, map)))
      .returning({ image: sql<string | null>`${bundleVersions.bundle}->'image'->>'digest'`, survey: sql<string | null>`${bundleVersions.bundle}->'survey'->>'digest'` });
    await tx.delete(maps).where(and(eq(maps.game, game), eq(maps.map, map)));
    const digests = [...new Set(versions.flatMap((row) => [row.image, row.survey]).filter((digest): digest is string => Boolean(digest)))];
    const images = digests.length
      ? await tx
          .delete(mapImages)
          .where(
            and(
              inArray(mapImages.digest, digests),
              sql`not exists (select 1 from ${bundleVersions} where ${bundleVersions.bundle}->'image'->>'digest' = ${mapImages.digest} or ${bundleVersions.bundle}->'survey'->>'digest' = ${mapImages.digest})`,
            ),
          )
          .returning({ digest: mapImages.digest })
      : [];
    return { versions: versions.length, runs: ids.length, images: images.length };
  });
}
