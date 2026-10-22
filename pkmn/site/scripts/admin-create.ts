import { createInterface } from "node:readline";
import { pool } from "../api/_lib/db.js";
import { createAdmin, usernameTaken } from "./accounts.js";

let pipedLines: AsyncIterator<string> | undefined;

async function readHidden(question: string): Promise<string> {
  const input = process.stdin;
  process.stdout.write(question);
  if (!input.isTTY) {
    pipedLines ??= createInterface({ input, terminal: false })[Symbol.asyncIterator]();
    const line = await pipedLines.next();
    process.stdout.write("\n");
    if (line.done) throw new Error("No password given");
    return line.value;
  }
  return new Promise((resolve, reject) => {
    let value = "";
    input.setRawMode(true);
    input.setEncoding("utf8");
    const finish = () => {
      input.setRawMode(false);
      input.off("data", onData);
      input.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          finish();
          reject(new Error("Cancelled"));
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    input.on("data", onData);
    input.resume();
  });
}

async function main() {
  const name = process.argv[2];
  if (process.argv.length !== 3 || !name || !/^[a-zA-Z0-9_.]{3,30}$/.test(name)) {
    throw new Error("Usage: npm run admin:create <name> (3 to 30 letters, digits, _ or .)");
  }
  const username = name.toLowerCase();
  if (await usernameTaken(username)) throw new Error(`${username} already exists`);

  const password = await readHidden("Password: ");
  if (password.length < 8) throw new Error("The password needs at least 8 characters");
  if ((await readHidden("Again: ")) !== password) throw new Error("The passwords differ");

  await createAdmin(name, password);
  console.log(`Admin ${username} created`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
