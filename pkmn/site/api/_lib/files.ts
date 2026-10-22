import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireEnv } from "./env.js";

const bucket = requireEnv("S3_BUCKET");

const s3 = new S3Client({
  endpoint: requireEnv("S3_ENDPOINT"),
  region: requireEnv("S3_REGION"),
  credentials: { accessKeyId: requireEnv("S3_ACCESS_KEY_ID"), secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY") },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const uploadSeconds = 60 * 60;
const downloadSeconds = 5 * 60;

export function uploadUrl(key: string, size: number): Promise<string> {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentLength: size }), {
    expiresIn: uploadSeconds,
  });
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

export async function putObject(key: string, body: Uint8Array): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
