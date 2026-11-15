import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, max, ne, sql } from "drizzle-orm";
import type { Bundle, Language, PublishedMap, Viewer } from "../../shared/bundle.js";
import type { Card, MapsPage, Member, Message, OpenRun, Rating, RunImport, RunSheet, Transcript } from "../../shared/runs.js";
import { db } from "./db.js";
import { publishedMaps } from "./maps.js";
import { hasMore, ladderKey, laddersOf, lineAt, withRequires } from "./ladders.js";
import { bundleVersions, coachCalls, deliveries, feedback, gaps, headsUpsGiven, hintCards, maps, messages, runKnowledge, runMembers, runs, runSteps } from "./schema.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const activeMember = isNull(runMembers.leftAt);

export type Time = <T>(name: string, work: Promise<T>) => Promise<T>;

async function lockPerson(tx: Tx, discordId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`member/${discordId}`}))`);
}

async function latestBundle(tx: Tx | typeof db, game: string, map: string): Promise<Bundle | null> {
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

function liveRuns() {
  return db
    .select({ id: runs.id, game: runs.game, map: runs.map, language: runs.language, startedBy: runs.startedByName, name: runMembers.name, discordId: runMembers.discordId })
    .from(runs)
    .innerJoin(runMembers, and(eq(runMembers.runId, runs.id), activeMember))
    .orderBy(asc(runs.createdAt), asc(runMembers.joinedAt));
}

function runOf(viewer: Viewer) {
  return db
    .select({ id: runs.id, game: runs.game, map: runs.map })
    .from(runMembers)
    .innerJoin(runs, eq(runs.id, runMembers.runId))
    .where(and(eq(runMembers.discordId, viewer.discordId), activeMember));
}

type LiveRun = { id: string; game: string; map: string; language: Language; startedBy: string; members: Member[] };

export async function mapsPage(viewer: Viewer, time: Time): Promise<MapsPage> {
  const [published, rows] = await Promise.all([time("maps", publishedMaps()), time("runs", liveRuns())]);
  const live = new Map<string, LiveRun>();
  for (const { name, discordId, ...run } of rows) {
    const entry = live.get(run.id) ?? { ...run, members: [] };
    entry.members.push({ name, you: discordId === viewer.discordId });
    live.set(run.id, entry);
  }
  const open = [...live.values()];
  const yours = open.find((run) => run.members.some((member) => member.you));
  const runsOf = (map: PublishedMap): OpenRun[] =>
    open
      .filter((run) => run.game === map.game && run.map === map.map)
      .map((run) => ({ id: run.id, language: run.language, startedBy: run.startedBy, members: run.members, you: run === yours }));
  const yourMap = yours && published.find((map) => map.game === yours.game && map.map === yours.map);
  return {
    viewer,
    maps: published.map((map) => ({ ...map, runs: runsOf(map) })),
    yourRun: yours && yourMap ? { id: yours.id, name: yourMap.name, language: yours.language, members: yours.members } : null,
  };
}

export async function runSheet(viewer: Viewer, runId: string, time: Time): Promise<RunSheet | null> {
  const [[run], published, members, [current]] = await Promise.all([
    time("run", db.select().from(runs).where(eq(runs.id, runId))),
    time("maps", publishedMaps()),
    time("members", activeMembers(viewer, [runId])),
    time("mine", runOf(viewer)),
  ]);
  if (!run) return null;
  const map = published.find((entry) => entry.game === run.game && entry.map === run.map);
  if (!map) return null;
  const other = current && current.id !== runId ? current : undefined;
  const otherMap = other && published.find((entry) => entry.game === other.game && entry.map === other.map);
  return {
    viewer,
    id: run.id,
    map,
    language: run.language,
    startedBy: run.startedByName,
    members: members.get(runId) ?? [],
    you: current?.id === runId,
    yourRun: other && otherMap ? { id: other.id, name: otherMap.name } : null,
  };
}

export async function isActiveMember(viewer: Viewer, runId: string): Promise<boolean> {
  return (await currentRunId(viewer)) === runId;
}

async function cardsSince(viewer: Viewer, runId: string, after: number, rungsAfter: number, newCards: boolean): Promise<Card[]> {
  const touched = await db
    .selectDistinct({ stepId: deliveries.stepId, partId: deliveries.partId })
    .from(deliveries)
    .where(and(eq(deliveries.runId, runId), gt(deliveries.id, rungsAfter)));
  const [since] = after ? await db.select({ at: messages.createdAt }).from(messages).where(and(eq(messages.runId, runId), eq(messages.id, after))) : [];
  const finished = await db
    .select({ stepId: runSteps.stepId, partId: runSteps.partId })
    .from(runSteps)
    .where(and(eq(runSteps.runId, runId), since ? gt(runSteps.doneAt, since.at) : isNotNull(runSteps.doneAt)));
  if (!touched.length && !newCards && !finished.length) return [];
  const ladderCards = await db
    .select({ id: hintCards.id, messageId: hintCards.messageId, stepId: hintCards.stepId, partId: hintCards.partId })
    .from(hintCards)
    .where(and(eq(hintCards.runId, runId), isNotNull(hintCards.messageId)))
    .orderBy(asc(hintCards.id));
  const keys = new Set(touched.map((entry) => ladderKey(entry.stepId, entry.partId)));
  const finishedKeys = new Set(finished.map((entry) => ladderKey(entry.stepId, entry.partId || null)));
  const wanted = ladderCards.filter(
    (card) => keys.has(ladderKey(card.stepId, card.partId)) || finishedKeys.has(card.stepId) || finishedKeys.has(ladderKey(card.stepId, card.partId)) || (card.messageId ?? 0) > after,
  );
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
  const done = new Set(
    (await db.select({ stepId: runSteps.stepId, partId: runSteps.partId }).from(runSteps).where(and(eq(runSteps.runId, runId), isNotNull(runSteps.doneAt)))).map((entry) =>
      ladderKey(entry.stepId, entry.partId || null),
    ),
  );
  const rated = new Map(
    (
      await db
        .select({ cardId: feedback.cardId, rating: feedback.rating })
        .from(feedback)
        .where(and(eq(feedback.runId, runId), eq(feedback.kind, "card"), eq(feedback.discordId, viewer.discordId), inArray(feedback.cardId, wanted.map((card) => card.id))))
    ).map((entry) => [entry.cardId, entry.rating]),
  );
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
      more: latest && ladder !== undefined && !done.has(card.stepId) && !done.has(key) && hasMore(ladder, given),
      rating: rated.get(card.id) ?? null,
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
  const revisionIds = rows.filter((row) => row.message.kind === "revision").map((row) => row.message.id);
  const referred = new Map(
    revisionIds.length
      ? (
          await db
            .select({ messageId: feedback.messageId, at: messages.createdAt })
            .from(feedback)
            .leftJoin(messages, eq(messages.id, feedback.refersTo))
            .where(and(eq(feedback.runId, runId), inArray(feedback.messageId, revisionIds)))
        ).map((entry) => [entry.messageId, entry.at?.toISOString() ?? null])
      : [],
  );
  return {
    messages: rows.map(
      ({ message: row, card }): Message => ({
        id: row.id,
        author: row.author,
        revision: row.kind === "revision" ? { re: referred.get(row.id) ?? null } : null,
        name: row.name,
        you: row.discordId === viewer.discordId,
        text: row.text,
        at: row.createdAt.toISOString(),
        card,
      }),
    ),
    members,
    cards: await cardsSince(
      viewer,
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

const acknowledgement: Record<Language, string> = { es: "Anotado, gracias.", en: "Noted, thanks." };

export async function postRevision(viewer: Viewer, runId: string, text: string): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [run] = await tx.select({ language: runs.language }).from(runs).where(eq(runs.id, runId));
    if (!run) return null;
    const [last] = await tx
      .select({ id: messages.id, card: hintCards.id })
      .from(messages)
      .leftJoin(hintCards, eq(hintCards.messageId, messages.id))
      .where(and(eq(messages.runId, runId), eq(messages.author, "cari"), ne(messages.kind, "ack")))
      .orderBy(desc(messages.id), desc(hintCards.id))
      .limit(1);
    const [rung] = last?.card
      ? await tx.select({ id: max(deliveries.id) }).from(deliveries).where(eq(deliveries.cardId, last.card))
      : [];
    const [message] = await tx
      .insert(messages)
      .values({ runId, author: "member", kind: "revision", discordId: viewer.discordId, name: viewer.name, text })
      .returning({ id: messages.id });
    await tx.insert(feedback).values({
      runId,
      kind: "revision",
      discordId: viewer.discordId,
      name: viewer.name,
      messageId: message!.id,
      refersTo: last?.id ?? null,
      cardId: last?.card ?? null,
      deliveryId: rung?.id ?? null,
      text,
    });
    const said = acknowledgement[run.language];
    await tx.insert(messages).values({ runId, author: "cari", kind: "ack", name: "Cari", text: said });
    return said;
  });
}

export async function rateCard(viewer: Viewer, runId: string, cardId: number, rating: Rating): Promise<boolean> {
  const [card] = await db
    .select({ id: hintCards.id })
    .from(hintCards)
    .where(and(eq(hintCards.id, cardId), eq(hintCards.runId, runId), isNotNull(hintCards.messageId)));
  if (!card) return false;
  const [rung] = await db.select({ id: max(deliveries.id) }).from(deliveries).where(eq(deliveries.cardId, cardId));
  const now = new Date();
  await db
    .insert(feedback)
    .values({ runId, kind: "card", discordId: viewer.discordId, name: viewer.name, cardId, deliveryId: rung?.id ?? null, rating })
    .onConflictDoUpdate({
      target: [feedback.cardId, feedback.discordId],
      targetWhere: sql`${feedback.kind} = 'card'`,
      set: { rating, deliveryId: rung?.id ?? null, name: viewer.name, updatedAt: now },
    });
  return true;
}

export async function runList() {
  const rows = await db.select().from(runs).orderBy(desc(runs.createdAt));
  const ids = rows.map((row) => row.id);
  if (!ids.length) return [];
  const members = await db.select({ runId: runMembers.runId, name: runMembers.name }).from(runMembers).where(inArray(runMembers.runId, ids));
  const tally = async (table: typeof messages | typeof gaps | typeof feedback | typeof deliveries) =>
    new Map((await db.select({ runId: table.runId, n: count() }).from(table).where(inArray(table.runId, ids)).groupBy(table.runId)).map((entry) => [entry.runId, entry.n]));
  const [lines, held, notes, rungs] = await Promise.all([tally(messages), tally(gaps), tally(feedback), tally(deliveries)]);
  const lastLine = new Map(
    (await db.select({ runId: messages.runId, at: max(messages.createdAt) }).from(messages).where(inArray(messages.runId, ids)).groupBy(messages.runId)).map((entry) => [entry.runId, entry.at]),
  );
  return rows.map((row) => ({
    id: row.id,
    game: row.game,
    map: row.map,
    language: row.language,
    startedBy: row.startedByName,
    createdAt: row.createdAt,
    lastLineAt: lastLine.get(row.id) ?? null,
    members: [...new Set(members.filter((member) => member.runId === row.id).map((member) => member.name))],
    counts: { messages: lines.get(row.id) ?? 0, deliveries: rungs.get(row.id) ?? 0, gaps: held.get(row.id) ?? 0, feedback: notes.get(row.id) ?? 0 },
  }));
}

export async function runLog(runId: string) {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  if (!run) return null;
  const [map] = await db.select({ latestVersion: maps.latestVersion }).from(maps).where(and(eq(maps.game, run.game), eq(maps.map, run.map)));
  const bundle = await latestBundle(db, run.game, run.map);
  const names = new Map((bundle?.knowledge ?? []).map((entry) => [entry.id, entry.name]));
  const [members, lines, cards, rungs, notes, held, marks, steps, headsUps, calls] = await Promise.all([
    db.select().from(runMembers).where(eq(runMembers.runId, runId)).orderBy(asc(runMembers.id)),
    db.select().from(messages).where(eq(messages.runId, runId)).orderBy(asc(messages.id)),
    db.select().from(hintCards).where(eq(hintCards.runId, runId)).orderBy(asc(hintCards.id)),
    db.select().from(deliveries).where(eq(deliveries.runId, runId)).orderBy(asc(deliveries.id)),
    db.select().from(feedback).where(eq(feedback.runId, runId)).orderBy(asc(feedback.id)),
    db.select().from(gaps).where(eq(gaps.runId, runId)).orderBy(asc(gaps.id)),
    db.select().from(runKnowledge).where(eq(runKnowledge.runId, runId)).orderBy(asc(runKnowledge.createdAt)),
    db.select().from(runSteps).where(eq(runSteps.runId, runId)),
    db.select().from(headsUpsGiven).where(eq(headsUpsGiven.runId, runId)).orderBy(asc(headsUpsGiven.createdAt)),
    db.select().from(coachCalls).where(eq(coachCalls.runId, runId)).orderBy(asc(coachCalls.id)),
  ]);
  const strip = <T extends { runId: string }>(rows: T[]) => rows.map(({ runId: _, ...rest }) => rest);
  return {
    run: { ...run, latestVersion: map?.latestVersion ?? null },
    members: strip(members),
    messages: strip(lines),
    cards: strip(cards),
    deliveries: strip(rungs),
    feedback: strip(notes),
    gaps: strip(held),
    marks: marks.map((mark) => ({ id: mark.knowledgeId, name: names.get(mark.knowledgeId) ?? null, at: mark.createdAt })),
    unknown: (bundle?.knowledge ?? []).filter((entry) => !marks.some((mark) => mark.knowledgeId === entry.id)).map((entry) => ({ id: entry.id, name: entry.name })),
    steps: strip(steps),
    headsUps: strip(headsUps),
    calls: strip(calls),
  };
}

const carriedOver: Record<Language, string> = { es: "De la sesión anterior.", en: "From the last session." };

export type Imported = { id: string; counts: Record<string, number> } | { error: string; issues: string[] };

export async function importRun(input: RunImport): Promise<Imported> {
  return db.transaction(async (tx) => {
    const [version] = await tx.select({ version: maps.latestVersion }).from(maps).where(and(eq(maps.game, input.game), eq(maps.map, input.map)));
    const bundle = await latestBundle(tx, input.game, input.map);
    if (!bundle || !version) return { error: "noSuchMap", issues: [] };
    const issues: string[] = [];
    const entries = new Set(bundle.knowledge.map((entry) => entry.id));
    for (const id of input.known) if (!entries.has(id)) issues.push(`known: ${id} names no knowledge entry`);
    const ladders = new Map(laddersOf(bundle.steps).map((ladder) => [ladderKey(ladder.stepId, ladder.partId), ladder]));
    const ids = new Set(input.members.map((member) => member.discordId));
    if (ids.size !== input.members.length) issues.push("members: a Discord ID is listed twice");
    const reached = new Map<string, number>();
    input.deliveries.forEach((entry, index) => {
      const key = ladderKey(entry.step, entry.part);
      const ladder = ladders.get(key);
      const rung = ladder?.rungs[entry.rung];
      if (!ladder) issues.push(`deliveries.${index}: ${key} names no ladder`);
      else if (!rung) issues.push(`deliveries.${index}: ${key} has no rung ${entry.rung}`);
      else if (!lineAt(rung, entry.alt)) issues.push(`deliveries.${index}: ${key} rung ${entry.rung} has no alt ${entry.alt}`);
      if ((reached.get(key) ?? -1) >= entry.rung) issues.push(`deliveries.${index}: ${key} rung ${entry.rung} comes after a later rung of its ladder`);
      reached.set(key, Math.max(reached.get(key) ?? -1, entry.rung));
      if (entry.askedBy !== null && !ids.has(entry.askedBy)) issues.push(`deliveries.${index}: askedBy is not a member`);
    });
    input.steps.forEach((entry, index) => {
      if (!ladders.has(ladderKey(entry.step, entry.part))) issues.push(`steps.${index}: ${ladderKey(entry.step, entry.part)} names no ladder`);
    });
    input.headsUps.forEach((entry, index) => {
      if (!bundle.steps.find((step) => step.id === entry.step)?.headsUps[entry.position]) issues.push(`headsUps.${index}: ${entry.step} has no heads-up ${entry.position}`);
    });
    if (issues.length) return { error: "invalidImport", issues };

    const id = randomBytes(6).toString("base64url");
    const [starter] = input.members;
    await tx.insert(runs).values({ id, game: input.game, map: input.map, language: input.language, startedBy: starter!.discordId, startedByName: starter!.name });
    for (const member of input.members) {
      await lockPerson(tx, member.discordId);
      await leaveCurrent(tx, member.discordId);
      await addMember(tx, id, { discordId: member.discordId, name: member.name, image: null });
    }
    const learned = new Set([...bundle.knowledge.filter((entry) => entry.mark === "known").map((entry) => entry.id), ...input.known]);
    const cards = new Map<string, number>();
    for (const entry of input.deliveries) {
      const key = ladderKey(entry.step, entry.part);
      let card = cards.get(key);
      if (card === undefined) {
        const [message] = await tx.insert(messages).values({ runId: id, author: "cari", name: "Cari", text: carriedOver[input.language] }).returning({ id: messages.id });
        const [created] = await tx.insert(hintCards).values({ runId: id, messageId: message!.id, stepId: entry.step, partId: entry.part }).returning({ id: hintCards.id });
        card = created!.id;
        cards.set(key, card);
      }
      const rung = ladders.get(key)!.rungs[entry.rung]!;
      const line = lineAt(rung, entry.alt)!;
      await tx.insert(deliveries).values({
        runId: id,
        cardId: card,
        stepId: entry.step,
        partId: entry.part,
        rung: entry.rung,
        alt: entry.alt,
        level: rung.level,
        text: line.text[input.language],
        mentions: line.mentions,
        reveals: line.reveals,
        bundleVersion: version.version,
        askedBy: entry.askedBy,
      });
      for (const known of [...line.mentions, ...line.reveals]) learned.add(known);
    }
    if (learned.size) await tx.insert(runKnowledge).values([...learned].map((knowledgeId) => ({ runId: id, knowledgeId })));
    const now = new Date();
    const progress = new Map<string, { stepId: string; partId: string; startedAt: Date | null; doneAt: Date | null; blockedToldAt: Date | null }>();
    const rowOf = (stepId: string, partId: string | null) => {
      const key = ladderKey(stepId, partId);
      const row = progress.get(key) ?? { stepId, partId: partId ?? "", startedAt: null, doneAt: null, blockedToldAt: null };
      progress.set(key, row);
      return row;
    };
    for (const entry of input.steps) {
      const row = rowOf(entry.step, entry.part);
      if (entry.started) row.startedAt = now;
      if (entry.blockedTold) row.blockedToldAt = now;
      if (!entry.done) continue;
      if (entry.part) row.doneAt = now;
      else for (const stepId of withRequires(bundle.steps, entry.step)) rowOf(stepId, null).doneAt = now;
    }
    if (progress.size) await tx.insert(runSteps).values([...progress.values()].map((row) => ({ runId: id, ...row })));
    const headsUps = [...new Map(input.headsUps.map((entry) => [`${entry.step}/${entry.position}`, entry])).values()];
    if (headsUps.length)
      await tx.insert(headsUpsGiven).values(
        headsUps.map((entry) => ({
          runId: id,
          stepId: entry.step,
          position: entry.position,
          text: bundle.steps.find((step) => step.id === entry.step)!.headsUps[entry.position]!.text[input.language],
          bundleVersion: version.version,
        })),
      );
    return {
      id,
      counts: { members: input.members.length, known: learned.size, cards: cards.size, deliveries: input.deliveries.length, steps: progress.size, headsUps: headsUps.length },
    };
  });
}
