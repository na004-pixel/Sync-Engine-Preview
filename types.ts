import type {
  Artifact,
  ArtifactId,
  ArtifactMetadata,
  ArtifactPayload,
  ArtifactVersion,
  SemanticKindId,
} from "@/artifacts/types";

export interface ArtifactPersistenceKey {
  semanticKind: SemanticKindId;
  id: ArtifactId;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends Record<string, unknown>
      ? DeepPartial<T[K]>
      : T[K];
};

export type ArtifactPatch = DeepPartial<{
  schemaVersion: ArtifactVersion;
  payload: ArtifactPayload;
  metadata: ArtifactMetadata;
}>;

export interface ArtifactPersistence {
  create(artifact: Artifact): Promise<Artifact>;
  get(key: ArtifactPersistenceKey): Promise<Artifact | null>;
  list(semanticKind: SemanticKindId): Promise<Artifact[]>;
  update(artifact: Artifact): Promise<Artifact>;
  patch(key: ArtifactPersistenceKey, patch: ArtifactPatch): Promise<Artifact>;
  delete(key: ArtifactPersistenceKey): Promise<Artifact | null>;
}
