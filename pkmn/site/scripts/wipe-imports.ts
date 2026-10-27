import { pool, db } from "../api/_lib/db.js";
import { deleteObject, objectsUnder } from "../api/_lib/files.js";
import { save, team } from "../api/_lib/schema.js";

if (!process.argv.includes("--yes")) {
  console.log(`This deletes every team, save and snapshot in ${new URL(process.env.DATABASE_URL ?? "postgres://unset").host}, and every file under saves/ in ${process.env.S3_BUCKET}. Run it again with --yes.`);
  process.exit(1);
}
const teams = await db.delete(team).returning({ id: team.id });
const saves = await db.delete(save).returning({ id: save.id });
const files = await objectsUnder("saves/");
for (const file of files) await deleteObject(file.key);
console.log(`Deleted ${teams.length} teams, ${saves.length} saves with their snapshots, and ${files.length} files.`);
await pool.end();
