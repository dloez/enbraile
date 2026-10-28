import type * as z from "zod";
import { api, putPart } from "@/lib/api";
import { partTicket, uploadAborted, type UploadTicket, uploadTicket } from "../../shared/games";
import { messages } from "../../shared/i18n";
import { uploadParts } from "../../shared/upload";

const t = messages({
  en: { wrong: "Something went wrong", orphaned: (reason: string) => `${reason}; its parts stay in the file store until the next upload` },
  es: { wrong: "Algo salió mal", orphaned: (reason: string) => `${reason}; sus partes se quedan en el almacén de archivos hasta la próxima subida` },
});

const abortAttempts = 3;

async function abort(base: string, { key, uploadId }: UploadTicket): Promise<boolean> {
  for (let attempt = 1; attempt <= abortAttempts; attempt += 1) {
    try {
      await api(`${base}/upload`, uploadAborted, { method: "DELETE", body: { key, uploadId } });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  return false;
}

export class UploadError extends Error {
  constructor(
    message: string,
    readonly sent: boolean,
  ) {
    super(message);
  }
}

export async function sendFile<T extends z.ZodType>(base: string, file: File, answer: T, onProgress: (fraction: number) => void): Promise<z.infer<T>> {
  let ticket: UploadTicket | undefined;
  let sent = false;
  try {
    ticket = await api(`${base}/upload`, uploadTicket, { body: { fileName: file.name, size: file.size } });
    const { key, uploadId, partSize } = ticket;
    const parts = await uploadParts(
      file.size,
      partSize,
      async (part, start, end, onPartProgress, signal) => {
        const { url } = await api(`${base}/upload/part`, partTicket, { body: { key, uploadId, size: file.size, part } });
        return putPart(url, file.slice(start, end), onPartProgress, signal);
      },
      onProgress,
    );
    sent = true;
    return await api(`${base}/file`, answer, { body: { key, uploadId, fileName: file.name, parts } });
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : t.wrong;
    const cleared = ticket ? await abort(base, ticket) : true;
    throw new UploadError(cleared ? reason : t.orphaned(reason), sent);
  }
}
