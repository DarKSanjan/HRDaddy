# ADR-010: Notification Architecture

**Status:** Accepted

## Context

HR Daddy needs to notify users about leave decisions, task assignments, document expiry, payslip availability, and other events. Notifications must not block the originating business operation. The system must support in-app notifications (always) and email (when configured).

## Decision

**Synchronous in-app notifications, asynchronous email dispatch.** In-app notifications are inserted into the database within the same transaction as the business operation (guarantees consistency). Email is dispatched after the transaction commits via a fire-and-forget call to the email adapter. A 5-minute deduplication window prevents duplicate notifications for the same event.

## Alternatives Considered

- **Fully async (message queue)** — adds infrastructure complexity (Redis/RabbitMQ) for V1; overkill for notification volumes of SME customers.
- **Fully synchronous including email** — email failures would fail business operations; SMTP timeouts would degrade UX.
- **Polling-based in-app** — requires client-side polling logic; WebSocket/SSE adds complexity.

## Consequences

- In-app notifications are always consistent with the operation that triggered them
- Email failures are logged but never break business logic
- Deduplication prevents spam when operations are retried
- V1 uses client-side polling for unread count (simple; no WebSocket infrastructure)

## Risks

- Email adapter failure results in missed emails (mitigated: retry with exponential backoff in background job)
- High notification volume could slow down transactions (mitigated: single INSERT; benchmark shows < 1ms)

## Revisit Conditions

- If real-time notifications are required (add WebSocket/SSE)
- If notification volume exceeds what synchronous INSERT can handle
- If email deliverability requires a dedicated queue (switch to proper message broker)
