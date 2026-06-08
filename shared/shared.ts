import type { Block } from "@/workspace/lib/services/editor";
import * as farmhash from "farmhashjs";

if (typeof Buffer !== "undefined" && !Buffer.prototype.readBigUInt64LE) {
  Buffer.prototype.readBigUInt64LE = function (offset = 0) {
    const lo = this.readUInt32LE(offset);
    const hi = this.readUInt32LE(offset + 4);
    return (BigInt(hi) << BigInt(32)) | BigInt(lo);
  };
}
export interface DocsAtomicVersion {
  generation: number;
  localVersion: number;
}

export interface DocsSnapshot {
  pageId: string;
  title: string;
  icon: string;
  metadata?: Record<string, any>;
  blocks: Block[];
}

export interface DocsVersionRecord {
  pageId: string;
  version: DocsAtomicVersion;
  contentHash: string;
  serializedSnapshot: string;
  snapshot: DocsSnapshot;
  createdAt: string;
}

export interface SaveDocsSnapshotResult {
  changed: boolean;
  version: DocsAtomicVersion;
  savedAt: string;
  contentHash: string;
}

export interface AppendDocsVersionRequest {
  workspaceId: string;
  pageId: string;
  version: DocsAtomicVersion;
  contentHash: string;
  requestId: string;
  createdAt: string;
  snapshot: DocsSnapshot;
}

export interface AppendDocsVersionResponse {
  ok: true;
  acceptedVersion: DocsAtomicVersion;
  contentHash: string;
  requestId: string;
  createdAt: string;
}

export interface GarbageCollectRemoteDocsRequest {
  workspaceId: string;
  pageId: string;
  highestRemoteAckVersion: DocsAtomicVersion;
  keepRecentGenerations: number;
}

export interface GarbageCollectRemoteDocsResponse {
  ok: true;
  deletedCount: number;
  deletedGenerations: number[];
}

export function cloneDocsSnapshot(snapshot: DocsSnapshot): DocsSnapshot {
  return {
    pageId: snapshot.pageId,
    title: snapshot.title,
    icon: snapshot.icon,
    metadata: snapshot.metadata,
    blocks: snapshot.blocks.map((block) => ({
      ...block,
      ...(block.columns ? { columns: [...block.columns] } : {}),
    })),
  };
}

export function serializeDocsSnapshot(snapshot: DocsSnapshot): string {
  return JSON.stringify(normalizeForStableStringify(snapshot));
}

export function hashSerializedSnapshot(serializedSnapshot: string): string {
  // Use 64-bit FarmHash as a zero-padded 16-character hex string
  const hashBigInt = BigInt(farmhash.fingerprint64(serializedSnapshot));
  return hashBigInt.toString(16).padStart(16, "0");
}

export function createFlushRequestId(
  pageId: string,
  version: DocsAtomicVersion,
  contentHash: string
) {
  return `docs:${pageId}:g${version.generation}:v${version.localVersion}:${contentHash}`;
}

export function createInitialDocsAtomicVersion(): DocsAtomicVersion {
  return {
    generation: 0,
    localVersion: 0,
  };
}

export function incrementDocsAtomicVersion(
  version: DocsAtomicVersion
): DocsAtomicVersion {
  return {
    generation: version.generation,
    localVersion: version.localVersion + 1,
  };
}

export function createRebasedDocsAtomicVersion(
  version: DocsAtomicVersion
): DocsAtomicVersion {
  return {
    generation: version.generation + 1,
    localVersion: 0,
  };
}

export function compareDocsAtomicVersion(
  left: DocsAtomicVersion,
  right: DocsAtomicVersion
) {
  if (left.generation !== right.generation) {
    return left.generation - right.generation;
  }

  return left.localVersion - right.localVersion;
}

export function areDocsAtomicVersionsEqual(
  left: DocsAtomicVersion | null,
  right: DocsAtomicVersion | null
) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.generation === right.generation &&
    left.localVersion === right.localVersion
  );
}

export function formatDocsAtomicVersion(version: DocsAtomicVersion) {
  return `g${version.generation}:v${version.localVersion}`;
}

export function normalizeForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForStableStringify(entry));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const nextValue = record[key];
        if (nextValue !== undefined) {
          acc[key] = normalizeForStableStringify(nextValue);
        }
        return acc;
      }, {});
  }

  return value;
}
