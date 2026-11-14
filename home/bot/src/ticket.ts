const TICKET_LIFETIME_MS = 60_000;

export const secret = process.env.INTERNAL_SECRET ?? "";
const publicUrl = process.env.PUBLIC_URL ?? "http://localhost:8080";

const hmac = async (message: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export async function ticketFor(module: string, userId: string): Promise<{ ticket: string; url: string }> {
  const claim = `${Date.now() + TICKET_LIFETIME_MS}.${userId}`;
  return { ticket: `${claim}.${await hmac(`${module}.${claim}`)}`, url: `${publicUrl.replace(/^http/, "ws")}/${module}/live` };
}

export async function verifyTicket(module: string, ticket: string): Promise<string | null> {
  const [expires, userId, signature] = ticket.split(".");
  if (!expires || !userId || !signature || Number(expires) < Date.now()) return null;
  return (await hmac(`${module}.${expires}.${userId}`)) === signature ? userId : null;
}
