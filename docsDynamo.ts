import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import zlib from "zlib";

// Cleansheet Mock Interfaces
interface VersionRequest { workspaceId: string; pageId: string; version: number; snapshot: any; contentHash: string; }
interface VersionResponse { ok: boolean; acceptedVersion: number; contentHash: string; }

const TABLE_NAME = process.env.SYNC_TABLE_NAME || "MockSyncTable";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function appendDocsVersion(request: VersionRequest): Promise<VersionResponse> {
  // 1. Brotli Compression (Slashing Payload Size / Costs by up to 60%)
  const serialized = JSON.stringify(request.snapshot);
  const compressedSnapshot = zlib.brotliCompressSync(Buffer.from(serialized, "utf-8"), {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 },
  });

  const item = {
    PK: `WS#${request.workspaceId}#DOC#${request.pageId}`,
    SK: `VER#${request.version.toString().padStart(8, "0")}`,
    workspaceId: request.workspaceId,
    contentHash: request.contentHash,
    payload: compressedSnapshot,
  };

  try {
    // 2. Optimistic Concurrency Control (OCC) preventing Data-Loss
    await client.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    }));
  } catch (error: any) {
    if (error.name === "ConditionalCheckFailedException") {
      // Idempotency check: if the exact hash exists, we safely ack it
      const existing = await getExactVersion(request.workspaceId, request.pageId, request.version);
      if (existing?.contentHash === request.contentHash) {
        return { ok: true, acceptedVersion: request.version, contentHash: request.contentHash };
      }
      throw new Error("DocsVersionConflictError: Race condition prevented by OCC.");
    }
    throw error;
  }

  return { ok: true, acceptedVersion: request.version, contentHash: request.contentHash };
}

// 3. GSI Query (Slashing read capacity units)
export async function listAllWorkspaceDocuments(workspaceId: string) {
  const response = await client.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "WorkspaceLookupIndex",
    KeyConditionExpression: "workspaceId = :wsId",
    ExpressionAttributeValues: { ":wsId": workspaceId },
  }));
  
  return response.Items;
}

export async function getLatestDocsVersion(workspaceId: string, pageId: string) {
  // Stubbed for preview purposes
  return null; 
}

async function getExactVersion(workspaceId: string, pageId: string, version: number) {
  const res = await client.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `WS#${workspaceId}#DOC#${pageId}`,
      SK: `VER#${version.toString().padStart(8, "0")}`
    }
  }));
  return res.Item;
}
