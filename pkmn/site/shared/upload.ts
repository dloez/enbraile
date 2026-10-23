const mebibyte = 1024 * 1024;
const smallestPart = 16 * mebibyte;
const mostParts = 10_000;
const partsAtOnce = 4;
const attemptsPerPart = 6;
const firstRetryMs = 1000;

export type UploadedPart = { part: number; etag: string };

export type SendPart = (
  part: number,
  start: number,
  end: number,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
) => Promise<string>;

export function partSizeFor(size: number): number {
  return Math.max(smallestPart, Math.ceil(size / mostParts));
}

export function partCount(size: number, partSize: number): number {
  return Math.max(1, Math.ceil(size / partSize));
}

export function partRange(size: number, partSize: number, part: number): { start: number; end: number } | undefined {
  if (!Number.isInteger(part) || part < 1 || part > partCount(size, partSize)) return undefined;
  const start = (part - 1) * partSize;
  return { start, end: Math.min(size, start + partSize) };
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export async function uploadParts(
  size: number,
  partSize: number,
  sendPart: SendPart,
  onProgress?: (fraction: number) => void,
): Promise<UploadedPart[]> {
  const count = partCount(size, partSize);
  const loaded = new Array<number>(count).fill(0);
  const uploaded: UploadedPart[] = [];
  const stop = new AbortController();
  let next = 1;

  const report = (index: number, bytes: number) => {
    loaded[index] = bytes;
    onProgress?.(loaded.reduce((sum, value) => sum + value, 0) / size);
  };

  async function send(part: number) {
    const range = partRange(size, partSize, part);
    if (!range) throw new Error(`No part ${part}`);
    for (let attempt = 1; ; attempt += 1) {
      try {
        const etag = await sendPart(part, range.start, range.end, (bytes) => report(part - 1, bytes), stop.signal);
        report(part - 1, range.end - range.start);
        return etag;
      } catch (error) {
        report(part - 1, 0);
        if (stop.signal.aborted || attempt === attemptsPerPart) throw error;
        await wait(firstRetryMs * 2 ** (attempt - 1), stop.signal);
      }
    }
  }

  async function worker() {
    while (next <= count && !stop.signal.aborted) {
      const part = next;
      next += 1;
      uploaded.push({ part, etag: await send(part) });
    }
  }

  const workers = Array.from({ length: Math.min(partsAtOnce, count) }, () =>
    worker().catch((error: unknown) => {
      if (!stop.signal.aborted) stop.abort(error);
      throw error;
    }),
  );
  const results = await Promise.allSettled(workers);
  if (stop.signal.aborted) throw stop.signal.reason;
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  return uploaded.sort((a, b) => a.part - b.part);
}
