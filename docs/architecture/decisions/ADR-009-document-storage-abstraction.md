# ADR-009: Document Storage Abstraction

**Status:** Accepted

## Context

HR Daddy stores employee documents (contracts, IDs, certificates). Self-hosted deployments need local filesystem storage. Cloud deployments need S3-compatible storage. The application must work with either without code changes.

## Decision

Use an **adapter pattern** with a `StorageAdapter` interface. V1 ships with two implementations: `LocalFilesystemAdapter` (default for self-hosted) and `S3Adapter` (for cloud deployments). The active adapter is selected via environment variable. Storage paths are always tenant-scoped: `{org_id}/{entity_type}/{entity_id}/{filename}`.

## Alternatives Considered

- **S3 only** — forces self-hosters to run MinIO or similar; unnecessary infrastructure for small deployments.
- **Database BLOB storage** — simple but bloats database backups, prevents CDN caching, and degrades DB performance.
- **Direct filesystem without abstraction** — works for V1 but locks out cloud storage without refactoring.

## Consequences

- Self-hosted V1 works with zero external services (Docker volume for storage)
- Cloud migration requires only changing an env var and providing credentials
- Signed URLs handled differently per adapter (local: time-limited token in URL; S3: pre-signed URL)
- Upload validation (MIME type, size) happens before adapter is called

## Risks

- Local filesystem adapter doesn't scale horizontally (mitigated: V1 is single-container)
- File cleanup on failed DB writes requires compensating transaction logic

## Revisit Conditions

- If multi-container deployment requires shared storage (use S3 or NFS)
- If CDN integration is needed for frequently accessed documents
- If virus scanning is required (add scanner step before adapter call)
