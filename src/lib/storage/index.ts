import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';

export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(keys: string[]): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9/_-]+\.(jpg|webp)$/;

class LocalStorage implements Storage {
  constructor(private root: string) {}
  private file(key: string) {
    if (!SAFE_KEY.test(key)) throw new Error('Invalid storage key');
    return path.join(this.root, key);
  }
  async put(key: string, data: Buffer) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, data, { flag: 'wx' });
  }
  async get(key: string) {
    try { return await readFile(this.file(key)); } catch { return null; }
  }
  async delete(keys: string[]) {
    await Promise.all(keys.map((k) => rm(this.file(k), { force: true })));
  }
}

class S3Storage implements Storage {
  private client: Promise<import('@aws-sdk/client-s3').S3Client>;
  constructor(private bucket: string) {
    this.client = import('@aws-sdk/client-s3').then(({ S3Client }) => new S3Client({
      region: env().S3_REGION,
      endpoint: env().S3_ENDPOINT,
      forcePathStyle: !!env().S3_ENDPOINT,
      credentials: env().S3_ACCESS_KEY_ID ? { accessKeyId: env().S3_ACCESS_KEY_ID!, secretAccessKey: env().S3_SECRET_ACCESS_KEY! } : undefined
    }));
  }
  async put(key: string, data: Buffer, contentType: string) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await (await this.client).send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }));
  }
  async get(key: string) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    try {
      const res = await (await this.client).send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return Buffer.from(await res.Body!.transformToByteArray());
    } catch { return null; }
  }
  async delete(keys: string[]) {
    if (!keys.length) return;
    const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
    await (await this.client).send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } }));
  }
}

let instance: Storage | undefined;
export function storage(): Storage {
  instance ??= env().S3_BUCKET ? new S3Storage(env().S3_BUCKET!) : new LocalStorage(path.resolve(env().UPLOAD_DIR));
  return instance;
}
