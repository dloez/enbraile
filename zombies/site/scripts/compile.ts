import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { z } from "zod";
import { bundleSchema, languages, zoneLevel, zoneSchema, type Language, type Zone } from "../shared/bundle.js";
import { imageFacts, maxImageBytes } from "../shared/image.js";

type Line = { text: string; mentions: string[]; reveals: string[] };
type Alt = Line & { level: number; when: string };
type Rung = Line & { level: number };
type Ladder = { rungs: Rung[]; alts: Alt[] };
type Part = { title: string; ladder: Ladder };
type HeadsUp = { when: string; text: string; mentions: string[] };
type Step = {
  number: number;
  title: string;
  requires: number[];
  optional: boolean;
  ladder: Ladder;
  parts: Part[];
  headsUps: HeadsUp[];
  onSuccess: Line | null;
};

const errors: string[] = [];
const warnings: string[] = [];

const dirArg = process.argv[2];
if (!dirArg) {
  console.error("usage: npm run compile -- <map dir>");
  process.exit(1);
}
const dir = resolve(process.env.INIT_CWD ?? process.cwd(), dirArg);

const readOptional = (name: string) => readFile(join(dir, name), "utf8").catch(() => null);
const read = async (name: string) => {
  const source = await readOptional(name);
  if (source === null) {
    console.error(`${name}: missing from ${dirArg}`);
    process.exit(1);
  }
  return source;
};

const knowledgeId = (raw: string) => raw.trim().toLowerCase();

const parseIds = (raw: string, where: string) => {
  const value = raw.trim().replace(/\.$/, "");
  if (/^none$/i.test(value)) return [];
  const ids = value.split(",").map((entry) => entry.trim());
  if (ids.some((id) => !/^K\d+$/.test(id))) errors.push(`${where}: Mentions or Reveals holds something other than knowledge IDs like K07`);
  return ids.filter((id) => /^K\d+$/.test(id)).map(knowledgeId);
};

const parseLine = (raw: string, where: string): Line => {
  const match = raw.match(/^(.*?)\s*Mentions:\s*(.+?)(?:\s+Reveals:\s*(.+))?\s*$/);
  if (!match) {
    errors.push(`${where}: no Mentions`);
    return { text: raw.trim(), mentions: [], reveals: [] };
  }
  const named = parseIds((match[2] ?? ""), where);
  const reveals = (match[3] ?? "") ? parseIds((match[3] ?? ""), where) : [];
  for (const id of reveals) if (!named.includes(id)) errors.push(`${where}: reveals ${id.toUpperCase()} without mentioning it`);
  return { text: (match[1] ?? "").trim(), mentions: named.filter((id) => !reveals.includes(id)), reveals };
};

const parseSteps = (source: string, file: string) => {
  const steps: Step[] = [];
  let step: Step | null = null;
  let part: Part | null = null;
  source.split("\n").forEach((rawLine, index) => {
    const where = `${file}:${index + 1}`;
    const heading = rawLine.match(/^## \S+ (\d+)\b/);
    if (heading) {
      step = { number: Number((heading[1] ?? "")), title: "", requires: [], optional: false, ladder: { rungs: [], alts: [] }, parts: [], headsUps: [], onSuccess: null };
      part = null;
      steps.push(step);
      return;
    }
    if (/^#/.test(rawLine)) {
      step = null;
      return;
    }
    if (!step) return;
    const current: Step = step;
    const nested = /^\s+-\s/.test(rawLine);
    const item = rawLine.replace(/^\s*-\s+/, "");
    if (!/^\s*-\s/.test(rawLine)) {
      const field = rawLine.match(/^(Spoiler-free title|Requires|Optional):\s*(.*)$/);
      if (!field) return;
      if ((field[1] ?? "") === "Spoiler-free title") current.title = (field[2] ?? "").trim();
      if ((field[1] ?? "") === "Optional") current.optional = /^yes$/i.test((field[2] ?? "").trim());
      if ((field[1] ?? "") === "Requires") {
        const value = (field[2] ?? "").trim().replace(/\.$/, "");
        current.requires = /^none$/i.test(value)
          ? []
          : value.split(",").map((entry) => {
              const number = entry.trim().match(/^Step (\d+)$/);
              if (!number) errors.push(`${where}: Requires holds something other than Step <n>`);
              return number ? Number((number[1] ?? "")) : NaN;
            });
      }
      return;
    }
    const target = nested ? part?.ladder : current.ladder;
    if (nested && !part) {
      errors.push(`${where}: indented line outside a Part ladder`);
      return;
    }
    if (!nested) part = null;
    const rung = item.match(/^L([1-4]):\s*(.*)$/);
    if (rung && target) {
      target.rungs.push({ level: Number((rung[1] ?? "")), ...parseLine((rung[2] ?? ""), where) });
      return;
    }
    const alt = item.match(/^Alt for L([1-4]) \((.+?)\):\s*(.*)$/);
    if (alt && target) {
      target.alts.push({ level: Number((alt[1] ?? "")), when: (alt[2] ?? "").trim(), ...parseLine((alt[3] ?? ""), where) });
      return;
    }
    if (nested) {
      errors.push(`${where}: a Part ladder holds only L<n> and Alt for L<n> lines`);
      return;
    }
    const partHead = item.match(/^Part ladder, (.+?):\s*$/);
    if (partHead) {
      part = { title: (partHead[1] ?? "").trim(), ladder: { rungs: [], alts: [] } };
      current.parts.push(part);
      return;
    }
    const headsUp = item.match(/^Heads-up \((.+?)\):\s*(.*)$/);
    if (headsUp) {
      const line = parseLine((headsUp[2] ?? ""), where);
      if (line.reveals.length) errors.push(`${where}: a Heads-up never reveals`);
      current.headsUps.push({ when: (headsUp[1] ?? "").trim(), text: line.text, mentions: line.mentions });
      return;
    }
    const success = item.match(/^On success:\s*(.*)$/);
    if (success) {
      current.onSuccess = parseLine((success[1] ?? ""), where);
      return;
    }
    errors.push(`${where}: unknown line; expected L<n>, Alt for L<n> (<when>), Part ladder, Heads-up (<when>) or On success`);
  });
  return steps;
};

const numbered = /\b(?:step|steps|paso|pasos|hint|hints|pista|pistas)\s*#?\d|\bL[1-4]\b|\b\d+\s*\/\s*\d+\b/i;

const checkNumbers = (text: string, where: string) => {
  if (numbered.test(text)) errors.push(`${where}: card text carries a step, hint or level number`);
};

const pairLines = (en: Line, es: Line, where: string) => {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));
  if (!same(en.mentions, es.mentions) || !same(en.reveals, es.reveals)) errors.push(`${where}: Spanish copy names different IDs`);
  checkNumbers(en.text, `${where} (en)`);
  checkNumbers(es.text, `${where} (es)`);
  return { text: { es: es.text, en: en.text }, mentions: en.mentions, reveals: en.reveals };
};

const pairLadder = (en: Ladder, es: Ladder | undefined, where: string) => {
  if (!es || es.rungs.length !== en.rungs.length || es.alts.length !== en.alts.length) {
    errors.push(`${where}: the Spanish copy has a different set of rungs or Alts`);
    return [];
  }
  const levels = en.rungs.map((rung) => rung.level);
  levels.forEach((level, index) => {
    if (index > 0 && level <= levels[index - 1]!) errors.push(`${where}: rungs must climb L1, L2, … in order, each level once`);
    if (es.rungs[index]!.level !== level) errors.push(`${where}: the Spanish copy's rung ${index + 1} is a different level`);
  });
  en.alts.forEach((alt, index) => {
    if (!levels.includes(alt.level)) errors.push(`${where}: an Alt for L${alt.level}, which the ladder lacks`);
    if (es.alts[index]!.level !== alt.level) errors.push(`${where}: the Spanish copy's Alt ${index + 1} replaces a different rung`);
  });
  return en.rungs.map((rung, index) => ({
    level: rung.level,
    ...pairLines(rung, es.rungs[index]!, `${where} L${rung.level}`),
    ...zoneAt(`${where} L${rung.level}`, rung.level),
    alts: en.alts
      .map((alt, altIndex) => ({ alt, altIndex }))
      .filter(({ alt }) => alt.level === rung.level)
      .map(({ alt, altIndex }) => ({ when: alt.when, ...pairLines(alt, es.alts[altIndex]!, `${where} Alt ${altIndex + 1}`), ...zoneAt(`${where} Alt ${altIndex + 1}`, alt.level, true) })),
  }));
};

const parseKnowledge = (source: string) => {
  const rows = source.split("\n").filter((line) => line.trim().startsWith("|"));
  const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  const header = rows.find((line) => cells(line)[0] === "ID");
  if (!header) {
    errors.push("knowledge.md: no table with an ID column");
    return [];
  }
  const names = cells(header);
  const column = (prefix: string) => names.findIndex((name) => name.startsWith(prefix));
  const [thing, status, spanish] = [column("Thing"), column("Status"), column("Spanish")];
  if (thing < 0 || status < 0) errors.push("knowledge.md: the table needs Thing and Status columns");
  return rows
    .map(cells)
    .filter((row) => /^K\d+$/.test(row[0] ?? ""))
    .map((row) => {
      const en = (row[thing] ?? "").replace(/\*\*/g, "");
      const cell = spanish >= 0 ? (row[spanish] ?? "") : "";
      const es = cell && !/^[-—–]$/.test(cell) ? cell.replace(/\*\*/g, "") : en;
      const mark = (row[status] ?? "").split(/\s/)[0]!.toLowerCase();
      if (!["known", "unknown", "revealed"].includes(mark)) errors.push(`knowledge.md: ${row[0]} has a status other than known, unknown or revealed`);
      return { id: knowledgeId(row[0]!), name: { es, en }, mark: mark === "known" ? ("known" as const) : ("unknown" as const) };
    });
};

const parseDossier = (dossier: string) => {
  const conditions = new Map<number, string[]>();
  const answers = new Map<number, Rung>();
  let step: number | null = null;
  let collecting = false;
  for (const [index, line] of dossier.split("\n").entries()) {
    const heading = line.match(/^## Step (\d+)\b/);
    if (heading) {
      step = Number((heading[1] ?? ""));
      collecting = false;
      continue;
    }
    if (/^#/.test(line)) {
      step = null;
      collecting = false;
      continue;
    }
    if (step === null) continue;
    const answer = line.match(/^- L4 as spoken:\s*(.*)$/);
    if (answer) {
      const line = parseLine(answer[1] ?? "", `dossier.md:${index + 1}`);
      answers.set(step, { level: 4, ...line, text: line.text.replace(/\s*\[K\d+(?:,\s*K\d+)*\]/g, "") });
      collecting = false;
      continue;
    }
    const field = line.match(/^- Conditions:\s*(.*)$/);
    if (field) {
      collecting = true;
      const inline = (field[1] ?? "").trim();
      conditions.set(step, inline ? [inline] : []);
      continue;
    }
    const sub = line.match(/^\s+-\s+(.*)$/);
    if (collecting && sub) {
      conditions.get(step)!.push((sub[1] ?? "").trim());
      continue;
    }
    if (collecting && /^\s+\S/.test(line)) {
      const entries = conditions.get(step)!;
      if (entries.length) entries[entries.length - 1] += ` ${line.trim()}`;
      else entries.push(line.trim());
      continue;
    }
    collecting = false;
  }
  return { conditions, answers };
};

const parseCalibration = (source: string | null) => {
  if (!source) return [];
  const entries: string[] = [];
  for (const line of source.split("\n")) {
    if (/^- /.test(line)) entries.push(line.slice(2).trim());
    else if (/^\s+\S/.test(line) && entries.length) entries[entries.length - 1] += `\n${line.trim()}`;
  }
  return entries;
};

const listFiles = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map((entry) => (entry.isDirectory() ? listFiles(join(root, entry.name)) : Promise.resolve([join(root, entry.name)]))));
  return nested.flat().sort();
};

const parseJson = (source: string | null) => {
  try {
    return JSON.parse(source ?? "null");
  } catch {
    return null;
  }
};

const fileName = z.string().regex(/^[^/\\]+$/);
const meta = z.object({ name: z.object({ es: z.string().min(1), en: z.string().min(1) }), art: z.enum(["teal", "rust", "furnace"]), test: z.boolean().optional(), image: fileName.optional(), survey: fileName.optional() }).safeParse(parseJson(await readOptional("map.json")));
if (!meta.success) {
  console.error("map.json: needs to be JSON with name.es, name.en and art (teal, rust or furnace), and image and survey only as file names");
  process.exit(1);
}

const readImage = async (name: string) => {
  const bytes = await readFile(join(dir, name)).catch(() => null);
  if (!bytes) {
    console.error(`map.json: image ${name} is missing from ${dirArg}`);
    process.exit(1);
  }
  if (bytes.length > maxImageBytes) {
    console.error(`map.json: image ${name} is over ${maxImageBytes / 1024 / 1024} MB`);
    process.exit(1);
  }
  const facts = imageFacts(bytes);
  if (!facts) {
    console.error(`map.json: image ${name} is not a JPEG, PNG or WebP file`);
    process.exit(1);
  }
  return { file: name, digest: createHash("sha256").update(bytes).digest("hex"), ...facts };
};
const image = meta.data.image ? await readImage(meta.data.image) : undefined;
const survey = meta.data.survey ? await readImage(meta.data.survey) : undefined;

const zonesSource = await readOptional("zones.json");
const zonesParsed = z.record(z.string(), zoneSchema).safeParse(zonesSource === null ? {} : parseJson(zonesSource));
if (!zonesParsed.success) {
  console.error("zones.json: needs to be JSON mapping a rung, such as \"step 5 L3\", \"step 5 part 1 L3\" or \"step 5 Alt 2\", to { x, y, rx, ry }, each a fraction of the survey image from 0 to 1");
  process.exit(1);
}
const zones: Record<string, Zone> = zonesParsed.data;
if (Object.keys(zones).length && !survey) errors.push("zones.json: zones need a survey image named in map.json");
const placed = new Set<string>();
const zoneAt = (address: string, level: number, alt = false) => {
  const zone = zones[address];
  if (!zone) return {};
  placed.add(address);
  if (level < zoneLevel) {
    errors.push(`zones.json: ${address} is ${alt ? "an Alt for " : ""}a level ${level} rung; a zone goes only on level ${zoneLevel} and up`);
    return {};
  }
  return { zone };
};

const hints: Record<Language, Step[]> = { en: parseSteps(await read("hints.md"), "hints.md"), es: parseSteps(await read("hints.es.md"), "hints.es.md") };
const dossier = await read("dossier.md");
const { conditions, answers } = parseDossier(dossier);
const knowledge = parseKnowledge(await read("knowledge.md"));

const spanish = new Map(hints.es.map((step) => [step.number, step]));
const stepNumbers = new Set(hints.en.map((step) => step.number));
for (const step of hints.es) if (!stepNumbers.has(step.number)) errors.push(`hints.es.md: step ${step.number} is not in hints.md`);

const steps = hints.en.map((en) => {
  const where = `step ${en.number}`;
  const answer = answers.get(en.number);
  if (!answer) errors.push(`${where}: no L4 as spoken in dossier.md`);
  if (en.ladder.rungs.some((rung) => rung.level === 4)) errors.push(`${where}: hints.md holds an L4; it belongs in dossier.md`);
  else if (answer) en.ladder.rungs.push(answer);
  const es = spanish.get(en.number);
  if (!es) errors.push(`${where}: missing from hints.es.md`);
  if (!en.title) errors.push(`${where}: no Spoiler-free title`);
  if (!en.onSuccess) errors.push(`${where}: no On success line`);
  if (es && !es.onSuccess) errors.push(`${where}: no On success line in hints.es.md`);
  for (const required of en.requires) if (!stepNumbers.has(required)) errors.push(`${where}: Requires step ${required}, which hints.md lacks`);
  if (es && (es.parts.length !== en.parts.length || es.headsUps.length !== en.headsUps.length)) errors.push(`${where}: the Spanish copy has a different set of Part ladders or Heads-ups`);
  const blank = { text: "", mentions: [], reveals: [] };
  return {
    id: `step-${en.number}`,
    title: en.title || where,
    requires: en.requires.map((number) => `step-${number}`),
    conditions: conditions.get(en.number) ?? [],
    optional: en.optional,
    onSuccess: pairLines(en.onSuccess ?? blank, es?.onSuccess ?? blank, `${where} On success`),
    ladder: pairLadder(en.ladder, es?.ladder, where),
    parts: en.parts.map((part, index) => ({ id: `part-${index + 1}`, title: part.title, ladder: pairLadder(part.ladder, es?.parts[index]?.ladder, `${where} part ${index + 1}`) })),
    headsUps: en.headsUps.map((headsUp, index) => {
      const other = es?.headsUps[index] ?? headsUp;
      const { text, mentions } = pairLines({ ...headsUp, reveals: [] }, { ...other, reveals: [] }, `${where} Heads-up ${index + 1}`);
      return { when: headsUp.when, text, mentions };
    }),
  };
});

for (const address of Object.keys(zones)) if (!placed.has(address)) errors.push(`zones.json: ${address} names no rung`);

const lines = steps.flatMap((step) => [step.onSuccess, ...[step.ladder, ...step.parts.map((part) => part.ladder)].flatMap((ladder) => ladder.flatMap((rung) => [rung, ...rung.alts]))]);
const unknown = new Set(knowledge.filter((entry) => entry.mark === "unknown").map((entry) => entry.id));
const revealed = new Set(lines.flatMap((line) => line.reveals));
const stranded = [...new Set(lines.flatMap((line) => line.mentions))].filter((id) => unknown.has(id) && !revealed.has(id)).sort();
if (stranded.length) warnings.push(`unknown and revealed by no line, so a line naming them waits until the players name them: ${stranded.map((id) => id.toUpperCase()).join(", ")}`);

const sources = await Promise.all((await listFiles(join(dir, "sources"))).map(async (file) => ({ title: relative(dir, file), text: await readFile(file, "utf8") })));

const candidate = {
  game: basename(dirname(dir)),
  map: basename(dir),
  name: meta.data.name,
  test: meta.data.test ?? false,
  art: meta.data.art,
  image,
  survey,
  knowledge,
  steps,
  calibration: parseCalibration(await readOptional("calibration.md")),
  dossier,
  sources,
};

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

const parsed = bundleSchema.safeParse(candidate);
if (!parsed.success) {
  for (const issue of parsed.error.issues) console.error(`${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

await writeFile(join(dir, "bundle.json"), `${JSON.stringify(parsed.data, null, 2)}\n`);
const ladders = parsed.data.steps.reduce((sum, step) => sum + 1 + step.parts.length, 0);
const rungs = parsed.data.steps.reduce((sum, step) => sum + [step.ladder, ...step.parts.map((part) => part.ladder)].reduce((inner, ladder) => inner + ladder.length, 0), 0);
const zoneCount = parsed.data.steps.reduce((sum, step) => sum + [step.ladder, ...step.parts.map((part) => part.ladder)].reduce((inner, ladder) => inner + ladder.reduce((count, rung) => count + (rung.zone ? 1 : 0) + rung.alts.filter((alt) => alt.zone).length, 0), 0), 0);
const alts = parsed.data.steps.reduce((sum, step) => sum + [step.ladder, ...step.parts.map((part) => part.ladder)].reduce((inner, ladder) => inner + ladder.reduce((count, rung) => count + rung.alts.length, 0), 0), 0);
console.log(`${parsed.data.game}/${parsed.data.map}: ${parsed.data.steps.length} steps, ${ladders} ladders, ${rungs} rungs, ${alts} alts, ${parsed.data.knowledge.length} knowledge entries, ${parsed.data.image ? `art ${parsed.data.image.width}x${parsed.data.image.height}` : "no art"}, ${zoneCount} zones${parsed.data.survey ? ` on a ${parsed.data.survey.width}x${parsed.data.survey.height} survey` : ""}, languages ${languages.join("+")} → ${relative(process.env.INIT_CWD ?? process.cwd(), join(dir, "bundle.json"))}`);
