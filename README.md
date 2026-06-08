# Offline-First Sync Engine - Code Sample

This is a limited public preview of a production-grade, offline-first synchronization engine and backend. It showcases the architectural patterns used to achieve zero data-loss state synchronization, extremely high read/write throughput, and significant database cost savings.

## What it does

At a high level, this system:
1. Safely queues document modifications locally in the browser when offline.
2. Synchronizes data with the cloud automatically as soon as the network is available, using resilient background polling mechanisms.
3. Authenticates API requests securely using a dual-authorization strategy (Machine-to-Machine JWTs or standard User Sessions).
4. Persists the data securely into AWS DynamoDB, guaranteeing no race conditions via Optimistic Concurrency Control (OCC).
5. Massively reduces payload sizes and database costs by compressing massive JSON structures on the fly.

## File Breakdown

### 1. The Client Hook (`client/`)
* **`useDocsRemoteFlush.ts`**: The frontend orchestration hook. It listens for `online` and `visibilitychange` events to proactively sync data. It manages an idempotent retry queue so that if a network request drops unexpectedly, it resumes safely without missing a beat.

### 2. The API Layer (`api/`)
* **`route.ts`**: The main entry point for the backend. It protects the exact IAM algorithms behind a dual-auth gatekeeper, actively validating either a `Bearer` token for M2M (backend-to-backend) operations, or falling back to the standard <20ms constant-time user authorization check.

### 3. The Backend Persistence (`backend/`)
* **`docsDynamo.ts`**: The core data access layer for DynamoDB. It highlights three major backend wins:
  * **Data-Loss Prevention**: Uses Optimistic Concurrency Control (`attribute_not_exists`) to prevent race conditions during parallel requests, gracefully resolving exact-hash collisions.
  * **Cost Slashing (Storage)**: Implements Brotli compression (`zlib.brotliCompressSync`) before persisting items, drastically reducing the physical size of stored payloads.
  * **Cost Slashing (Reads)**: Employs a finely tuned Global Secondary Index (`WorkspaceLookupIndex`) for fetching lists natively without falling back to expensive full-table scans.

### 4. Shared Definitions (`shared/`)
* **`shared.ts` & `types.ts`**: The strict schema constraints that ensure the frontend payloads structurally match what the backend expects to hash and serialize.
