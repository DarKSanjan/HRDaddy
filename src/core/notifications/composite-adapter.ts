/**
 * Composite (fan-out) notification adapter.
 *
 * Sends to all sub-adapters. A failing adapter is logged but does not
 * break delivery to other adapters — same philosophy as the event bus.
 */
import type { NotificationAdapter, NotificationPayload } from './index'

export class CompositeNotificationAdapter implements NotificationAdapter {
  constructor(private readonly adapters: NotificationAdapter[]) {}

  async send(payload: NotificationPayload): Promise<void> {
    for (const adapter of this.adapters) {
      try {
        await adapter.send(payload)
      } catch (err) {
        console.error(
          `[CompositeNotificationAdapter] Sub-adapter threw:`,
          err instanceof Error ? err.message : err
        )
      }
    }
  }
}
