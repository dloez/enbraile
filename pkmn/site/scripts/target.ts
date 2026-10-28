import { requireEnv } from "../api/_lib/env.js";

export const previewBucket = "pkmn-site-preview-enbraile";

export function localOrPreview(variable: string, job: string): boolean {
  const remote = ["DATABASE_URL", "S3_ENDPOINT"]
    .map((name) => new URL(requireEnv(name)).hostname)
    .filter((host) => host !== "localhost" && host !== "127.0.0.1");
  if (remote.length === 0) return false;
  if (process.env[variable] !== "preview" || requireEnv("S3_BUCKET") !== previewBucket) {
    throw new Error(`Refusing to run the ${job} on ${remote.join(" and ")}: the ${job} is for the local stack, or for the preview environment with ${variable}=preview and the ${previewBucket} bucket`);
  }
  return true;
}
