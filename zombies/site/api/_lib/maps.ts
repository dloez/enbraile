import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Bundle, PublishedMap } from "../../shared/bundle.js";
import { db } from "./db.js";
import { bundleVersions, maps } from "./schema.js";

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
    })
    .from(maps)
    .innerJoin(bundleVersions, and(eq(bundleVersions.game, maps.game), eq(bundleVersions.map, maps.map), eq(bundleVersions.version, maps.latestVersion)))
    .orderBy(maps.createdAt);
  return rows;
}
