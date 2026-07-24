/**
 * Synchronous in-process event bus.
 * Handlers must be idempotent. A throwing handler is logged but does not
 * roll back the emitting transaction.
 */
export interface EventContext {
  orgId: string
  userId: string
}

type EventHandlerFn = (payload: unknown, ctx: EventContext) => Promise<void>

const handlers = new Map<string, EventHandlerFn[]>()

/**
 * Subscribe a handler to an event.
 */
export function on(eventName: string, handler: EventHandlerFn): void {
  const list = handlers.get(eventName) || []
  list.push(handler)
  handlers.set(eventName, list)
}

/**
 * Emit an event. All handlers run, but a throwing handler
 * must not break the emitter.
 */
export async function emit(
  event: string,
  payload: unknown,
  ctx: EventContext
): Promise<void> {
  const list = handlers.get(event) || []
  for (const handler of list) {
    try {
      await handler(payload, ctx)
    } catch (error) {
      // Log and continue — a handler must never break the emitter
      console.error(
        `[EventBus] Handler for '${event}' threw:`,
        error instanceof Error ? error.message : error
      )
    }
  }
}

/**
 * Get all registered handlers for an event (for testing).
 */
export function getHandlers(eventName: string): EventHandlerFn[] {
  return handlers.get(eventName) || []
}

/**
 * Reset the bus (for testing).
 */
export function _resetEvents(): void {
  handlers.clear()
}
