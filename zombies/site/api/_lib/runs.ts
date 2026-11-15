import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { Bundle, Language, PublishedMap, Viewer } from "../../shared/bundle.js";
import type { Card, MapsPage, Member, Message, OpenRun, RunSheet, Transcript } from "../../shared/runs.js";
import { db } from "./db.js";
import { publishedMaps } from "./maps.js";
import { hasMore, ladderKey, laddersOf } from "./ladders.js";
import { bundleVersions, deliveries, hintCards, maps, messages, runKnowledge, runMembers, runs } from "./schema.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const activeMember = isNull(runMembers.leftAt);

async function lockPerson(tx: Tx, discordId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`member/${discordId}`}))`);
}

async function latestBundle(tx: Tx, game: string, map: string): Promise<Bundle | null> {
  const [row] = await tx
    .select({ bundle: bundleVersions.bundle })
    .from(maps)
    .innerJoin(bundleVersions, and(eq(bundleVersions.game, maps.game), eq(bundleVersions.map, maps.map), eq(bundleVersions.version, maps.latestVersion)))
    .where(and(eq(maps.game, game), eq(maps.map, map)));
  return row?.bundle ?? null;
}

async function leaveCurrent(tx: Tx, discordId: string): Promise<void> {
  await tx.update(runMembers).set({ leftAt: new Date() }).where(and(eq(runMembers.discordId, discordId), activeMember));
}

async function learnFromEarlierRuns(tx: Tx, runId: string, game: string, map: string, discordId: string): Promise<void> {
  await tx.execute(sql`
    insert into ${runKnowledge} (run_id, knowledge_id)
    select distinct ${runId}, rk.knowledge_id
    from ${runKnowledge} rk
    join ${runMembers} m on m.run_id = rk.run_id
    join ${runs} r on r.id = rk.run_id
    where m.discord_id = ${discordId} and r.game = ${game} and r.map = ${map} and r.id <> ${runId}
    on conflict do nothing`);
}

async function addMember(tx: Tx, runId: string, viewer: Viewer): Promise<void> {
  await tx.insert(runMembers).values({ runId, discordId: viewer.discordId, name: viewer.name, image: viewer.image });
}

export async function startRun(viewer: Viewer, game: string, map: string, language: Language): Promise<string | null> {
  return db.transaction(async (tx) => {
    await lockPerson(tx, viewer.discordId);
    const bundle = await latestBundle(tx, game, map);
    if (!bundle) return null;
    const id = randomBytes(6).toString("base64url");
    await leaveCurrent(tx, viewer.discordId);
    await tx.insert(runs).values({ id, game, map, language, startedBy: viewer.discordId, startedByName: viewer.name });
    await addMember(tx, id, viewer);
    const baseline = bundle.knowledge.filter((entry) => entry.mark === "known").map((entry) => ({ runId: id, knowledgeId: entry.id }));
    if (baseline.length) await tx.insert(runKnowledge).values(baseline).onConflictDoNothing();
    await learnFromEarlierRuns(tx, id, game, map, viewer.discordId);
    return id;
  });
}

export async function joinRun(viewer: Viewer, runId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await lockPerson(tx, viewer.discordId);
    const [run] = await tx.select().from(runs).where(eq(runs.id, runId));
    if (!run) return false;
    const [current] = await tx
      .select({ runId: runMembers.runId })
      .from(runMembers)
      .where(and(eq(runMembers.discordId, viewer.discordId), activeMember));
    if (current?.runId === runId) return true;
    await leaveCurrent(tx, viewer.discordId);
    await addMember(tx, runId, viewer);
    await learnFromEarlierRuns(tx, runId, run.game, run.map, viewer.discordId);
    return true;
  });
}

async function activeMembers(viewer: Viewer, runIds: string[]): Promise<Map<string, Member[]>> {
  const grouped = new Map<string, Member[]>();
  if (!runIds.length) return grouped;
  const rows = await db
    .select({ runId: runMembers.runId, name: runMembers.name, discordId: runMembers.discordId })
    .from(runMembers)
    .where(and(activeMember, inArray(runMembers.runId, runIds)))
    .orderBy(asc(runMembers.joinedAt));
  for (const row of rows) grouped.set(row.runId, [...(grouped.get(row.runId) ?? []), { name: row.name, you: row.discordId === viewer.discordId }]);
  return grouped;
}

async function currentRunId(viewer: Viewer): Promise<string | null> {
  const [row] = await db
    .select({ runId: runMembers.runId })
    .from(runMembers)
    .where(and(eq(runMembers.discordId, viewer.discordId), activeMember));
  return row?.runId ?? null;
}

export async function mapsPage(viewer: Viewer): Promise<MapsPage> {
  const published = await publishedMaps();
  const open = await db
    .select({ id: runs.id, game: runs.game, map: runs.map, language: runs.language, startedBy: runs.startedByName })
    .from(runs)
    .orderBy(asc(runs.createdAt));
  const members = await activeMembers(
    viewer,
    open.map((run) => run.id),
  );
  const mine = await currentRunId(viewer);
  const runsOf = (map: PublishedMap): OpenRun[] =>
    open
      .filter((run) => run.game === map.game && run.map === map.map)
      .map((run) => ({ id: run.id, language: run.language, startedBy: run.startedBy, members: members.get(run.id) ?? [], you: run.id === mine }));
  const yours = open.find((run) => run.id === mine);
  const yourMap = yours && published.find((map) => map.game === yours.game && map.map === yours.map);
  return {
    maps: published.map((map) => ({ ...map, runs: runsOf(map) })),
    yourRun: yours && yourMap ? { id: yours.id, name: yourMap.name, language: yours.language, members: members.get(yours.id) ?? [] } : null,
  };
}

export async function runSheet(viewer: Viewer, runId: string): Promise<RunSheet | null> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  if (!run) return null;
  const published = await publishedMaps();
  const map = published.find((entry) => entry.game === run.game && entry.map === run.map);
  if (!map) return null;
  const members = (await activeMembers(viewer, [runId])).get(runId) ?? [];
  const mine = await currentRunId(viewer);
  const [other] = mine && mine !== runId ? await db.select({ id: runs.id, game: runs.game, map: runs.map }).from(runs).where(eq(runs.id, mine)) : [];
  const otherMap = other && published.find((entry) => entry.game === other.game && entry.map === other.map);
  return {
    id: run.id,
    map,
    language: run.language,
    startedBy: run.startedByName,
    members,
    you: mine === runId,
    yourRun: other && otherMap ? { id: other.id, name: otherMap.name } : null,
  };
}

export async function isActiveMember(viewer: Viewer, runId: string): Promise<boolean> {
  return (await currentRunId(viewer)) === runId;
}

async function cardsSince(runId: string, after: number, rungsAfter: number, newCards: boolean): Promise<Card[]> {
  const touched = await db
    .selectDistinct({ stepId: deliveries.stepId, partId: deliveries.partId })
    .from(deliveries)
    .where(and(eq(deliveries.runId, runId), gt(deliveries.id, rungsAfter)));
  if (!touched.length && !newCards) return [];
  const ladderCards = await db
    .select({ id: hintCards.id, messageId: hintCards.messageId, stepId: hintCards.stepId, partId: hintCards.partId })
    .from(hintCards)
    .where(and(eq(hintCards.runId, runId), isNotNull(hintCards.messageId)))
    .orderBy(asc(hintCards.id));
  const keys = new Set(touched.map((entry) => ladderKey(entry.stepId, entry.partId)));
  const wanted = ladderCards.filter((card) => keys.has(ladderKey(card.stepId, card.partId)) || (card.messageId ?? 0) > after);
  if (!wanted.length) return [];
  const rungs = await db
    .select({
      id: deliveries.id,
      cardId: deliveries.cardId,
      stepId: deliveries.stepId,
      partId: deliveries.partId,
      rung: deliveries.rung,
      text: deliveries.text,
      at: deliveries.createdAt,
    })
    .from(deliveries)
    .where(and(eq(deliveries.runId, runId), inArray(deliveries.stepId, [...new Set(wanted.map((card) => card.stepId))])))
    .orderBy(asc(deliveries.id));
  const [row] = await db
    .select({ steps: sql<Bundle["steps"]>`${bundleVersions.bundle}->'steps'` })
    .from(runs)
    .innerJoin(maps, and(eq(maps.game, runs.game), eq(maps.map, runs.map)))
    .innerJoin(bundleVersions, and(eq(bundleVersions.game, maps.game), eq(bundleVersions.map, maps.map), eq(bundleVersions.version, maps.latestVersion)))
    .where(eq(runs.id, runId));
  const ladders = new Map(laddersOf(row?.steps ?? []).map((ladder) => [ladderKey(ladder.stepId, ladder.partId), ladder]));
  return wanted.map((card) => {
    const key = ladderKey(card.stepId, card.partId);
    const onLadder = rungs.filter((rung) => ladderKey(rung.stepId, rung.partId) === key);
    const given = onLadder.reduce((most, rung) => Math.max(most, rung.rung + 1), 0);
    const latest = ladderCards.filter((other) => ladderKey(other.stepId, other.partId) === key).at(-1)?.id === card.id;
    const ladder = ladders.get(key);
    const own = onLadder.filter((rung) => rung.cardId === card.id);
    return {
      id: card.id,
      rungs: own.map((rung) => ({ id: rung.id, text: rung.text })),
      at: (own.at(-1)?.at ?? new Date()).toISOString(),
      more: latest && ladder !== undefined && hasMore(ladder, given),
    };
  });
}

export async function transcript(viewer: Viewer, runId: string, after: number, rungsAfter: number): Promise<Transcript> {
  const rows = await db
    .select({ message: messages, card: hintCards.id })
    .from(messages)
    .leftJoin(hintCards, eq(hintCards.messageId, messages.id))
    .where(and(eq(messages.runId, runId), gt(messages.id, after)))
    .orderBy(asc(messages.id));
  const members = (await activeMembers(viewer, [runId])).get(runId) ?? [];
  return {
    messages: rows.map(
      ({ message: row, card }): Message => ({
        id: row.id,
        author: row.author,
        name: row.name,
        you: row.discordId === viewer.discordId,
        text: row.text,
        at: row.createdAt.toISOString(),
        card,
      }),
    ),
    members,
    cards: await cardsSince(
      runId,
      after,
      rungsAfter,
      rows.some((row) => row.card !== null),
    ),
  };
}

export async function postMessage(viewer: Viewer, runId: string, text: string): Promise<number> {
  const [row] = await db.insert(messages).values({ runId, author: "member", discordId: viewer.discordId, name: viewer.name, text }).returning({ id: messages.id });
  return row!.id;
}

