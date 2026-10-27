import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireEnv } from "./env.js";

const bucket = requireEnv("S3_BUCKET");

const s3 = new S3Client({
  endpoint: requireEnv("S3_ENDPOINT"),
  region: requireEnv("S3_REGION"),
  credentials: { accessKeyId: requireEnv("S3_ACCESS_KEY_ID"), secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY") },
  forcePathStyle: true,
  maxAttempts: 2,
  requestHandler: { connectionTimeout: 5_000, requestTimeout: 20_000 },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const partSeconds = 60 * 60;
const downloadSeconds = 5 * 60;

export async function startUpload(key: string): Promise<string> {
  const { UploadId } = await s3.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key }));
  if (!UploadId) throw new Error("The file store did not start the upload");
  return UploadId;
}

export function partUrl(key: string, uploadId: string, part: number, size: number): Promise<string> {
  return getSignedUrl(
    s3,
    new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: part, ContentLength: size }),
    { expiresIn: partSeconds },
  );
}

export async function completeUpload(key: string, uploadId: string, parts: { part: number; etag: string }[]): Promise<void> {
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.map(({ part, etag }) => ({ PartNumber: part, ETag: etag })) },
    }),
  );
}

export async function abortUpload(key: string, uploadId: string): Promise<void> {
  try {
    await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
  } catch (error) {
    if (!(error instanceof Error && error.name === "NoSuchUpload")) throw error;
  }
}

export async function abortUploadsUnder(prefix: string): Promise<void> {
  let keyMarker: string | undefined;
  let uploadIdMarker: string | undefined;
  do {
    const page = await s3.send(
      new ListMultipartUploadsCommand({ Bucket: bucket, KeyMarker: keyMarker, UploadIdMarker: uploadIdMarker }),
    );
    for (const upload of page.Uploads ?? []) {
      if (upload.Key?.startsWith(prefix) && upload.UploadId) await abortUpload(upload.Key, upload.UploadId).catch(() => undefined);
    }
    keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
    uploadIdMarker = page.IsTruncated ? page.NextUploadIdMarker : undefined;
  } while (keyMarker);
}

export function downloadUrl(key: string, fileName: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }),
    { expiresIn: downloadSeconds },
  );
}

export async function objectSize(key: string): Promise<number | undefined> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength;
  } catch {
    return undefined;
  }
}

export async function putObject(key: string, body: Uint8Array, contentType = "application/zip"): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function readObject(key: string): Promise<Uint8Array> {
  const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!Body) throw new Error("The file store sent nothing back");
  return Body.transformToByteArray();
}

export async function readRange(key: string, start: number, end: number): Promise<Uint8Array> {
  const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=${start}-${end - 1}` }));
  if (!Body) throw new Error("The file store sent nothing back");
  return Body.transformToByteArray();
}

export async function objectsUnder(prefix: string): Promise<{ key: string; modified: Date | undefined }[]> {
  const found: { key: string; modified: Date | undefined }[] = [];
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    for (const object of page.Contents ?? []) if (object.Key) found.push({ key: object.Key, modified: object.LastModified });
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return found;
}
