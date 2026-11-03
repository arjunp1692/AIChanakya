import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/** Upload size cap (PLAN §1). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Allowlisted file types: extension → content type served on download. */
export const ALLOWED_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const ALLOWED_MIME = new Set(Object.values(ALLOWED_FILE_TYPES));

export const fileExtension = (name: string) => path.extname(name).slice(1).toLowerCase();

/** Content type for a stored file name; null if the extension is not allowlisted. */
export const contentTypeFor = (name: string): string | null => ALLOWED_FILE_TYPES[fileExtension(name)] ?? null;

/** Why `name`/`mime`/`size` can't be stored, or null if it can. Browsers may send an empty mime type. */
export function uploadProblem(name: string, mime: string, size: number): string | null {
  if (size === 0) return "The file is empty";
  if (size > MAX_UPLOAD_BYTES) return "Files can be at most 10 MB";
  if (!contentTypeFor(name) || (mime && !ALLOWED_MIME.has(mime))) {
    return `File type not allowed (allowed: ${Object.keys(ALLOWED_FILE_TYPES).join(", ")})`;
  }
  return null;
}

/** Blob store. Keys are opaque, `/`-separated; dev uses local disk, prod can swap in S3 (S35). */
export interface Storage {
  put(prefix: string, name: string, data: Uint8Array): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class LocalDiskStorage implements Storage {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(prefix: string, name: string, data: Uint8Array): Promise<string> {
    const safe = path.basename(name).replace(/[^\w.-]+/g, "_").slice(-100) || "file";
    const key = `${prefix}/${randomUUID()}-${safe}`;
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return key;
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

export const storage: Storage = new LocalDiskStorage(path.resolve(process.env.UPLOAD_DIR ?? "uploads"));
