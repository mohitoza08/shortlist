import { db } from "./db";

/**
 * Private resume storage. Demo build keeps bytes in Postgres (never a public URL);
 * swap for Vercel Blob private / S3 behind this interface. See BUILD_LOG D4.
 */
export async function putFile(applicationId: string, bytes: Buffer) {
  await db.resumeFile.upsert({
    where: { applicationId },
    create: { applicationId, bytes: new Uint8Array(bytes) },
    update: { bytes: new Uint8Array(bytes) },
  });
}

export async function getFile(applicationId: string) {
  const f = await db.resumeFile.findUnique({ where: { applicationId } });
  return f ? Buffer.from(f.bytes) : null;
}

export async function deleteFile(applicationId: string) {
  await db.resumeFile.deleteMany({ where: { applicationId } });
}
