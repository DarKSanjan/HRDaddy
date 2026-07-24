/**
 * Event bus tests — handlers fire, a throwing handler does not break the emitter.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { on, emit, _resetEvents } from '@/core/events'

describe('Event Bus', () => {
  beforeEach(() => {
    _resetEvents()
  })

  it('handlers fire when an event is emitted', async () => {
    const handler = vi.fn()
    on('TestEvent', handler)

    const ctx = { orgId: 'org-1', userId: 'user-1' }
    await emit('TestEvent', { foo: 'bar' }, ctx)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' }, ctx)
  })

  it('multiple handlers all fire', async () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    on('TestEvent', handler1)
    on('TestEvent', handler2)

    const ctx = { orgId: 'org-1', userId: 'user-1' }
    await emit('TestEvent', { data: 123 }, ctx)

    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  it('a throwing handler does not break the emitter', async () => {
    const errorHandler = vi.fn().mockRejectedValue(new Error('Handler failed'))
    const successHandler = vi.fn()

    on('TestEvent', errorHandler)
    on('TestEvent', successHandler)

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ctx = { orgId: 'org-1', userId: 'user-1' }

    // Should not throw
    await expect(emit('TestEvent', {}, ctx)).resolves.toBeUndefined()

    // The success handler still runs
    expect(successHandler).toHaveBeenCalledTimes(1)
    // Error was logged
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })

  it('emitting an event with no handlers does nothing', async () => {
    const ctx = { orgId: 'org-1', userId: 'user-1' }
    await expect(emit('UnknownEvent', {}, ctx)).resolves.toBeUndefined()
  })
})
