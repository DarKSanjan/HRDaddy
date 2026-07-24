# Tenant Isolation Design

This document defines how HR Daddy enforces multi-tenant data isolation. Every piece of organisation-owned data must be inaccessible to users of other organisations, regardless of the access vector — UI, API, background jobs, file storage, or cache.

---

## 1. Organisation Context Resolution

### How Org Context is Established

Organisation context is resolved exclusively from the authenticated session, never from client-supplied parameters.

**Flow:**

1. User authenticates → session is created with `userId`
2. User selects/accesses an organisation → session is stamped with `organisationId`
3. Every subsequent request reads `organisationId` from the session
4. The middleware validates that the user has an active `OrganisationMembership` for that `organisationId`

```typescript
// Context resolver middleware (runs on every org-scoped request)
async function resolveOrgContext(req: Request): Promise<OrgContext> {
  const session = await getSession(req);
  
  if (!session?.userId || !session?.organisationId) {
    throw new AuthenticationError('Session missing org context');
  }

  // Validate membership is still active
  const membership = await db.organisationMembership.findFirst({
    where: {
      userId: session.userId,
      organisationId: session.organisationId,
      status: 'active',
    },
  });

  if (!membership) {
    throw new AuthorizationError('No active membership for this organisation');
  }

  return {
    userId: session.userId,
    organisationId: session.organisationId,
    role: membership.role,
    employeeId: membership.employeeId, // nullable
  };
}
```

### Key Principles

- `organisationId` in the session is the **sole source of truth** for tenant context
- Even if a request body or URL parameter contains an `organisationId`, it is **ignored for authorization** (may be used for validation/assertion only)
- Switching organisations updates the session and invalidates the previous org context (BR-AUTH-006)
- Background jobs must receive org context explicitly at dispatch time (not inferred from ambient state)

---

## 2. Membership Validation

Before any org-scoped operation executes, the middleware confirms:

1. **Session validity** — the session has not expired or been revoked
2. **User exists** — the `userId` in the session maps to an active user
3. **Membership active** — an `OrganisationMembership` record exists with `status = 'active'` for this user + org pair
4. **Employee active** (if applicable) — if the membership links to an Employee, the employee is not deactivated (BR-AUTH-005)

```typescript
// Membership validation (part of context resolution)
interface MembershipValidation {
  isAuthenticated: boolean;       // Valid session exists
  hasMembership: boolean;         // Active membership for org
  employeeIsActive: boolean;      // Linked employee not deactivated (or no employee linked)
  role: 'owner' | 'hr_admin' | 'manager' | 'employee';
}
```

If any check fails, the request is rejected before reaching business logic.

---

## 3. Tenant-Scoped Queries

### Mandatory Scoping

Every database query that touches organisation-owned data **must** include `organisationId` in its WHERE clause. This is enforced at the repository layer — no business logic or controller can bypass it.

```typescript
// Repository base class — all org-scoped repos extend this
abstract class TenantScopedRepository<T> {
  constructor(private readonly orgContext: OrgContext) {}

  protected get orgId(): string {
    return this.orgContext.organisationId;
  }

  // Every query method injects org scope automatically
  protected scopedWhere(additionalWhere: object = {}): object {
    return {
      organisationId: this.orgId,
      ...additionalWhere,
    };
  }
}

// Example: Employee repository
class EmployeeRepository extends TenantScopedRepository<Employee> {
  async findById(employeeId: string): Promise<Employee | null> {
    return db.employee.findFirst({
      where: this.scopedWhere({ id: employeeId }),
    });
  }

  async findAll(filters?: EmployeeFilters): Promise<Employee[]> {
    return db.employee.findMany({
      where: this.scopedWhere({
        status: { not: 'archived' },
        ...filters,
      }),
    });
  }
}
```

### Construction Pattern

Repositories are instantiated per-request with the resolved org context:

```typescript
// In a server action or API handler
export async function getEmployee(employeeId: string) {
  const ctx = await resolveOrgContext(request);
  const repo = new EmployeeRepository(ctx);
  
  const employee = await repo.findById(employeeId);
  if (!employee) {
    // Returns 404, not 403 — prevents info leakage
    throw new NotFoundError('Employee not found');
  }
  return employee;
}
```

---

## 4. Cross-Tenant Prevention

### Strategy: Defence in Depth

Cross-tenant access is prevented at multiple layers:

| Layer | Mechanism |
|-------|-----------|
| **Session** | Org context locked to session; switching orgs invalidates previous context |
| **Middleware** | Membership validation before any handler executes |
| **Repository** | All queries scoped by `organisationId` automatically |
| **Database** | `organisationId` is NOT NULL on all tenant-owned tables |
| **Response** | Cross-tenant resources return 404 (not 403) to prevent existence probing |
| **File Storage** | Paths prefixed with `organisationId` |
| **Cache** | Keys prefixed with `organisationId` |

### Response Behaviour on Cross-Tenant Attempts

When a user attempts to access a resource that belongs to a different organisation:

- The scoped query returns `null` (because the WHERE includes their org, not the target org)
- The system returns **404 Not Found**, not 403 Forbidden
- No information about the resource's existence is revealed
- The attempt is logged in the audit trail as a suspicious access pattern

```typescript
// Cross-tenant attempt results in 404
// User in Org A requests employee from Org B
const employee = await repo.findById(employeeIdFromOrgB);
// → Returns null because WHERE includes organisationId = orgA
// → Handler throws NotFoundError
// → Client receives: { "error": { "code": "NOT_FOUND", "message": "Resource not found." } }
```

### URL Parameter Handling

Even if an `organisationId` is present in the URL (e.g., `/api/orgs/:orgId/employees`), it is **never trusted for authorization**:

```typescript
// SAFE: URL orgId is validated against session orgId
export async function handler(req: Request, params: { orgId: string }) {
  const ctx = await resolveOrgContext(req);
  
  // Assert URL param matches session (optional — defense in depth)
  if (params.orgId !== ctx.organisationId) {
    throw new NotFoundError('Resource not found');
  }
  
  // Proceed with ctx.organisationId (from session)
}
```

---

## 5. File Storage Scoping

### Storage Path Structure

All file storage paths include the organisation ID as a mandatory prefix:

```
/{organisationId}/{entityType}/{entityId}/{filename}

Examples:
/org_abc123/documents/emp_xyz789/contract_2024.pdf
/org_abc123/branding/logo.png
/org_abc123/documents/emp_xyz789/id_scan.jpg
```

### Access Control

- Signed URLs are generated server-side after permission + tenant checks
- URLs expire after 5 minutes (configurable)
- The storage path is never exposed to the client — only the signed URL
- Path construction always uses `ctx.organisationId`, never a user-supplied value

```typescript
class TenantScopedStorageAdapter {
  constructor(private readonly orgContext: OrgContext) {}

  private buildPath(entityType: string, entityId: string, filename: string): string {
    // Organisation ID is ALWAYS from the authenticated context
    return `${this.orgContext.organisationId}/${entityType}/${entityId}/${filename}`;
  }

  async getSignedDownloadUrl(entityType: string, entityId: string, filename: string): Promise<string> {
    const path = this.buildPath(entityType, entityId, filename);
    return this.storageClient.getSignedUrl(path, {
      action: 'read',
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
    });
  }

  async upload(entityType: string, entityId: string, filename: string, data: Buffer): Promise<string> {
    const path = this.buildPath(entityType, entityId, filename);
    await this.storageClient.upload(path, data);
    return path;
  }
}
```

### Cross-Tenant File Prevention

- Storage bucket policies restrict access by path prefix (if using cloud storage IAM)
- The application layer never constructs paths using client-supplied org IDs
- If a signed URL from one org is somehow intercepted, it expires quickly and cannot be reused for other orgs' files

---

## 6. Cache Scoping

### Cache Key Structure

All cached data includes the organisation ID in the cache key:

```
{organisationId}:{cacheType}:{identifier}

Examples:
org_abc123:employee_count:active
org_abc123:leave_balance:emp_xyz789:annual
org_abc123:dashboard:admin_metrics
org_abc123:settings:timezone
```

### Implementation

```typescript
class TenantScopedCache {
  constructor(private readonly orgContext: OrgContext) {}

  private buildKey(type: string, identifier: string): string {
    return `${this.orgContext.organisationId}:${type}:${identifier}`;
  }

  async get<T>(type: string, identifier: string): Promise<T | null> {
    const key = this.buildKey(type, identifier);
    return this.cacheClient.get<T>(key);
  }

  async set<T>(type: string, identifier: string, value: T, ttlMs?: number): Promise<void> {
    const key = this.buildKey(type, identifier);
    await this.cacheClient.set(key, value, ttlMs);
  }

  async invalidate(type: string, identifier: string): Promise<void> {
    const key = this.buildKey(type, identifier);
    await this.cacheClient.delete(key);
  }

  // Invalidate all cache entries for this org (e.g., on settings change)
  async invalidateOrg(): Promise<void> {
    const pattern = `${this.orgContext.organisationId}:*`;
    await this.cacheClient.deletePattern(pattern);
  }
}
```

### Cache Isolation Guarantees

- Cache reads can never return another org's data because the key includes `organisationId`
- Cache invalidation for one org does not affect other orgs
- If a user switches organisations, their subsequent cache reads use the new org key
- Shared/global caches (e.g., rate limiting) use user-level keys, not org-level keys

---

## 7. Background Job Context

### Problem

Background jobs (scheduled tasks, event handlers, queue consumers) execute outside the HTTP request cycle. They have no session, no cookies, and no ambient org context. Without explicit handling, a background job could accidentally process data across tenant boundaries.

### Solution: Explicit Context Injection

Every background job receives org context as a required parameter at dispatch time:

```typescript
// Job dispatch — org context captured at dispatch time
interface TenantScopedJob {
  jobType: string;
  organisationId: string;  // REQUIRED — captured from the triggering request
  payload: Record<string, unknown>;
  dispatchedBy: string;    // userId who triggered the job
  dispatchedAt: string;    // ISO timestamp
}

// Dispatching a job (from a request handler)
async function dispatchExpiryCheck(ctx: OrgContext) {
  await jobQueue.enqueue({
    jobType: 'document_expiry_check',
    organisationId: ctx.organisationId,  // From authenticated session
    payload: {},
    dispatchedBy: ctx.userId,
    dispatchedAt: new Date().toISOString(),
  });
}
```

### Job Execution

```typescript
// Job handler — reconstructs tenant context before processing
async function handleDocumentExpiryCheck(job: TenantScopedJob) {
  // Validate org still exists and is active
  const org = await db.organisation.findFirst({
    where: { id: job.organisationId, status: 'active' },
  });
  if (!org) {
    logger.warn('Skipping job for inactive org', { orgId: job.organisationId });
    return;
  }

  // Create scoped context for this job
  const jobContext: OrgContext = {
    userId: job.dispatchedBy,
    organisationId: job.organisationId,
    role: 'system', // Background jobs run with system-level access
    employeeId: null,
  };

  // All queries within this job are scoped
  const docRepo = new DocumentRepository(jobContext);
  const expiringDocs = await docRepo.findExpiringSoon(30); // days
  
  for (const doc of expiringDocs) {
    await notificationService.send(jobContext, {
      type: 'document_expiring',
      targetUserId: doc.employee.userId,
      data: { documentId: doc.id, expiresAt: doc.expiryDate },
    });
  }
}
```

### Scheduled Jobs (Multi-Tenant)

For jobs that run across all organisations (e.g., nightly expiry checks):

```typescript
// Scheduled job that iterates over all active orgs
async function nightlyDocumentExpiryCheck() {
  const activeOrgs = await db.organisation.findMany({
    where: { status: 'active' },
    select: { id: true },
  });

  for (const org of activeOrgs) {
    // Each org is processed with isolated context
    const jobContext: OrgContext = {
      userId: 'system',
      organisationId: org.id,
      role: 'system',
      employeeId: null,
    };

    const docRepo = new DocumentRepository(jobContext);
    const expiringDocs = await docRepo.findExpiringSoon(30);
    // ... process within this org's context only
  }
}
```

### Key Rules for Background Jobs

1. **Never process multiple orgs in the same query** — iterate per-org
2. **Always validate org is active** before processing
3. **Log org context** in every job log entry for traceability
4. **Test cross-org leakage** — verify a job for org A never touches org B data
5. **Failures are per-org** — one org's failure does not block others

---

## 8. Safe and Unsafe Query Patterns

### UNSAFE Patterns (Never Do This)

```typescript
// ❌ UNSAFE: No org scoping — returns data from ALL orgs
async function getEmployeeUnsafe(employeeId: string) {
  return db.employee.findFirst({
    where: { id: employeeId },
  });
}

// ❌ UNSAFE: Org ID from request body — can be spoofed
async function getEmployeesUnsafe(req: Request) {
  const { organisationId } = await req.json();
  return db.employee.findMany({
    where: { organisationId },
  });
}

// ❌ UNSAFE: Org ID from URL param without session validation
async function getEmployeeUnsafe(req: Request, params: { orgId: string }) {
  return db.employee.findMany({
    where: { organisationId: params.orgId },
  });
}

// ❌ UNSAFE: Raw SQL without org scope
async function searchEmployeesUnsafe(searchTerm: string) {
  return db.$queryRaw`
    SELECT * FROM employee WHERE name ILIKE ${`%${searchTerm}%`}
  `;
}

// ❌ UNSAFE: Joining across org boundaries
async function getManagerReportsUnsafe(managerId: string) {
  return db.reportingRelationship.findMany({
    where: { managerId },
    include: { employee: true },
    // Missing: organisationId scope
  });
}

// ❌ UNSAFE: Background job without explicit org context
async function processAllExpiringDocs() {
  const docs = await db.employeeDocument.findMany({
    where: { expiryDate: { lte: thirtyDaysFromNow } },
    // Processes ALL orgs in one query — context confusion
  });
}

// ❌ UNSAFE: Cache key without org prefix
async function getCachedCount() {
  return cache.get('active_employee_count');
  // Same key for all orgs — returns wrong org's data
}
```

### SAFE Patterns (Always Do This)

```typescript
// ✅ SAFE: Org context from session, scoped query
async function getEmployee(ctx: OrgContext, employeeId: string) {
  return db.employee.findFirst({
    where: {
      id: employeeId,
      organisationId: ctx.organisationId, // From authenticated session
    },
  });
}

// ✅ SAFE: Repository pattern with automatic scoping
class EmployeeRepository extends TenantScopedRepository<Employee> {
  async findById(employeeId: string): Promise<Employee | null> {
    return db.employee.findFirst({
      where: this.scopedWhere({ id: employeeId }),
    });
  }

  async search(term: string): Promise<Employee[]> {
    return db.employee.findMany({
      where: this.scopedWhere({
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { workEmail: { contains: term, mode: 'insensitive' } },
        ],
      }),
    });
  }
}

// ✅ SAFE: Raw SQL with org scope
async function searchEmployees(ctx: OrgContext, searchTerm: string) {
  return db.$queryRaw`
    SELECT * FROM employee
    WHERE organisation_id = ${ctx.organisationId}
    AND name ILIKE ${`%${searchTerm}%`}
  `;
}

// ✅ SAFE: Background job with per-org iteration
async function processExpiringDocs(orgId: string) {
  const docs = await db.employeeDocument.findMany({
    where: {
      organisationId: orgId,
      expiryDate: { lte: thirtyDaysFromNow },
    },
  });
  // Process only this org's documents
}

// ✅ SAFE: Cache with org-prefixed key
async function getCachedCount(ctx: OrgContext) {
  const key = `${ctx.organisationId}:employee_count:active`;
  return cache.get(key);
}

// ✅ SAFE: File path with org prefix
function buildDocumentPath(ctx: OrgContext, empId: string, filename: string) {
  return `${ctx.organisationId}/documents/${empId}/${filename}`;
}

// ✅ SAFE: Cross-tenant return 404
async function getResource(ctx: OrgContext, resourceId: string) {
  const resource = await db.resource.findFirst({
    where: {
      id: resourceId,
      organisationId: ctx.organisationId,
    },
  });
  if (!resource) {
    // 404, not 403 — prevents probing
    throw new NotFoundError('Resource not found');
  }
  return resource;
}
```

---

## 9. Audit Events and Tenant Context

Every audit event records the organisation context in which it was created:

```typescript
interface AuditEvent {
  id: string;
  organisationId: string;    // Tenant scope
  actorId: string;           // User who performed the action
  action: string;            // e.g., 'employee.create', 'leave.approve'
  targetType: string;        // e.g., 'employee', 'leave_request'
  targetId: string;          // ID of the affected resource
  before: object | null;     // Previous state (for updates)
  after: object | null;      // New state (for creates/updates)
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    source: 'web' | 'api' | 'background_job';
  };
  createdAt: string;         // Server-assigned UTC timestamp
}
```

Audit logs are themselves tenant-scoped — an org can only view its own audit history.

---

## 10. Testing Cross-Tenant Isolation

### Automated Test Strategy

Every repository and service must include cross-tenant tests:

```typescript
describe('Tenant Isolation', () => {
  let orgA: Organisation;
  let orgB: Organisation;
  let employeeInOrgA: Employee;
  let userInOrgB: User;

  beforeAll(async () => {
    orgA = await createTestOrg('Org A');
    orgB = await createTestOrg('Org B');
    employeeInOrgA = await createTestEmployee(orgA);
    userInOrgB = await createTestUser(orgB);
  });

  it('cannot access employee from another org via repository', async () => {
    const ctx = createOrgContext(userInOrgB, orgB);
    const repo = new EmployeeRepository(ctx);
    
    const result = await repo.findById(employeeInOrgA.id);
    expect(result).toBeNull(); // Not found, not forbidden
  });

  it('cannot access document file from another org', async () => {
    const ctx = createOrgContext(userInOrgB, orgB);
    const storage = new TenantScopedStorageAdapter(ctx);
    
    // Path for org A's document — will build path with org B's ID
    const url = await storage.getSignedDownloadUrl(
      'documents', employeeInOrgA.id, 'contract.pdf'
    );
    // URL points to orgB/documents/... which doesn't exist
    // Actual file is at orgA/documents/... — inaccessible
  });

  it('returns 404 for cross-tenant API access', async () => {
    const response = await request(app)
      .get(`/api/employees/${employeeInOrgA.id}`)
      .set('Cookie', sessionCookieForOrgB);
    
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('background job only processes its own org', async () => {
    await processExpiringDocs(orgA.id);
    
    // Verify no notifications sent to org B users
    const orgBNotifications = await db.notification.findMany({
      where: { organisationId: orgB.id },
    });
    expect(orgBNotifications).toHaveLength(0);
  });

  it('cache isolation between orgs', async () => {
    const cacheA = new TenantScopedCache(createOrgContext(null, orgA));
    const cacheB = new TenantScopedCache(createOrgContext(null, orgB));
    
    await cacheA.set('employee_count', 'active', 10);
    
    const resultFromB = await cacheB.get('employee_count', 'active');
    expect(resultFromB).toBeNull(); // Org B has no cached value
  });
});
```

### Manual Verification Checklist

- [ ] Create two test organisations with distinct data
- [ ] Sign in as user in Org A → verify cannot see Org B employees
- [ ] Attempt direct URL manipulation with Org B employee IDs → returns 404
- [ ] Attempt to forge org_id in request body → system uses session org
- [ ] Verify file download URLs are org-scoped
- [ ] Verify notifications are org-scoped
- [ ] Verify audit logs are org-scoped
- [ ] Verify dashboard metrics are org-scoped
- [ ] Verify leave calendars are org-scoped
- [ ] Verify payroll is org-scoped
- [ ] Run background jobs → verify no cross-org data processing
- [ ] Check cache keys include org prefix
- [ ] Verify exports contain only current org's data

---

## Summary of Enforcement Points

| Concern | Enforcement |
|---------|-------------|
| Request org context | Session-derived, membership-validated middleware |
| Database queries | Repository base class injects `organisationId` into all WHERE clauses |
| File storage | Org-prefixed paths, server-generated signed URLs |
| Caching | Org-prefixed cache keys |
| Background jobs | Explicit org context at dispatch, per-org iteration |
| API responses | 404 for cross-tenant resources (not 403) |
| Audit events | Org-scoped, queryable only within same org |
| Exports | Generated from org-scoped queries |
| URL parameters | Never trusted for authorization; validated against session |
| Notifications | Scoped to org; only visible in matching org context |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| Initial | Complete tenant isolation design | HR Daddy Architecture |
