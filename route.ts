import { NextResponse } from "next/server";
import { appendDocsVersion, getLatestDocsVersion } from "./docsDynamo";

// Mocked dual-authorization strategy protecting exact IAM IP
const authorizeRequest = async (request: Request, workspaceId: string, action: "read" | "write") => {
  const authHeader = request.headers.get("Authorization");

  // Strategy 1: Machine-to-Machine (M2M) Auth
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    // In production: perform lightweight JWT verification via SPKI public key
    const isM2mValid = token.length > 0; // Mock validation
    if (!isM2mValid) return NextResponse.json({ error: "Invalid M2M token" }, { status: 401 });
    
    return null; // M2M authorized
  }

  // Strategy 2: User Session Auth (Clerk)
  // In production: Integrates with the <20ms constant-time IAM engine
  const userHasAccess = true; // Mock validation
  if (!userHasAccess) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  return null; // User authorized
};

export async function GET(request: Request, context: { params: Promise<{ workspaceId: string; pageId: string }> }) {
  const { workspaceId, pageId } = await context.params;
  
  const authResponse = await authorizeRequest(request, workspaceId, "read");
  if (authResponse) return authResponse;

  const latest = await getLatestDocsVersion(workspaceId, pageId);
  return NextResponse.json({ ok: true, latest });
}

export async function POST(request: Request, context: { params: Promise<{ workspaceId: string; pageId: string }> }) {
  const { workspaceId, pageId } = await context.params;
  const body = await request.json();

  if (body.pageId !== pageId) {
    return NextResponse.json({ error: "Page ID mismatch" }, { status: 400 });
  }

  const authResponse = await authorizeRequest(request, workspaceId, "write");
  if (authResponse) return authResponse;

  try {
    const response = await appendDocsVersion({ ...body, workspaceId });
    return NextResponse.json(response);
  } catch (error: any) {
    if (error.name === "DocsVersionConflictError") return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
