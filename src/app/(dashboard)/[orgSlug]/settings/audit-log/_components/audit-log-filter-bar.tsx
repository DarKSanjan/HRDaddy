import { Button, Select } from '@/core/ui'

interface AuditLogFilterBarProps {
  orgSlug: string
  actors: Array<{ id: string; name: string }>
  currentActorId?: string
  currentAction?: string
  currentFrom?: string
  currentTo?: string
}

/**
 * Plain GET form — filters live entirely in the URL, so the page stays a
 * server component and filter state survives a refresh/share/back-nav.
 */
export function AuditLogFilterBar({
  orgSlug,
  actors,
  currentActorId,
  currentAction,
  currentFrom,
  currentTo,
}: AuditLogFilterBarProps) {
  return (
    <form
      method="get"
      action={`/${orgSlug}/settings/audit-log`}
      className="mb-4 flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="actorId" className="text-[12px] font-medium text-text-muted">
          Actor
        </label>
        <Select id="actorId" name="actorId" defaultValue={currentActorId ?? ''}>
          <option value="">All</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="action" className="text-[12px] font-medium text-text-muted">
          Action contains
        </label>
        <input
          id="action"
          name="action"
          type="text"
          defaultValue={currentAction ?? ''}
          placeholder="e.g. expense, auth.sign_in"
          className="h-9 rounded-md border border-border bg-surface px-3 text-[13px] text-text"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="from" className="text-[12px] font-medium text-text-muted">
          From
        </label>
        <input
          id="from"
          name="from"
          type="date"
          defaultValue={currentFrom ?? ''}
          className="h-9 rounded-md border border-border bg-surface px-3 text-[13px] text-text"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="to" className="text-[12px] font-medium text-text-muted">
          To
        </label>
        <input
          id="to"
          name="to"
          type="date"
          defaultValue={currentTo ?? ''}
          className="h-9 rounded-md border border-border bg-surface px-3 text-[13px] text-text"
        />
      </div>

      <Button type="submit" size="sm">
        Apply
      </Button>
      {(currentActorId || currentAction || currentFrom || currentTo) && (
        <Button asChild variant="ghost" size="sm">
          <a href={`/${orgSlug}/settings/audit-log`}>Clear</a>
        </Button>
      )}
    </form>
  )
}
