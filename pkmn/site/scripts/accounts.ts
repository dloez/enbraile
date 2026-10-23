import { eq } from "drizzle-orm";
import { auth } from "../api/_lib/auth.js";
import { db } from "../api/_lib/db.js";
import { account, user } from "../api/_lib/schema.js";

export async function usernameTaken(username: string): Promise<boolean> {
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.username, username));
  return existing !== undefined;
}

export async function createAdmin(name: string, password: string): Promise<void> {
  const username = name.toLowerCase();
  const context = await auth.$context;
  const hash = await context.password.hash(password);
  await db.transaction(async (tx) => {
    const id = context.generateId({ model: "user" }) || crypto.randomUUID();
    await tx.insert(user).values({
      id,
      name,
      email: `${username}@admin.invalid`,
      username,
      displayUsername: name,
      admin: true,
    });
    await tx.insert(account).values({
      id: context.generateId({ model: "account" }) || crypto.randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: hash,
    });
  });
}

export async function createTestPlayer(name: string, allowed: boolean): Promise<void> {
  const username = name.toLowerCase();
  const context = await auth.$context;
  await db.insert(user).values({
    id: context.generateId({ model: "user" }) || crypto.randomUUID(),
    name,
    email: `${username}@test.invalid`,
    username,
    displayUsername: name,
    allowed,
  });
}
