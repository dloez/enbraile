import type * as z from "zod";

export async function body<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T> | undefined> {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  return parsed.success ? parsed.data : undefined;
}
