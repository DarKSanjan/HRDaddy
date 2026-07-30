import * as React from 'react'
import { CalendarDays, Cake, Award, Flag } from 'lucide-react'
import { ChartCard, ChartEmpty } from '@/core/ui/charts'
import type { WidgetProps } from '@/core/dashboard'
import { getUpcomingCalendarItems } from '@/core/dashboard/widget-queries'
import { format } from 'date-fns'

export async function CalendarUpcomingWidget(props: WidgetProps) {
  const items = await getUpcomingCalendarItems(
    props.orgId,
    props.userId,
    props.role,
    props.orgTimezone
  )

  if (items.length === 0) {
    return (
      <ChartCard title="Upcoming">
        <ChartEmpty message="No upcoming calendar items." />
      </ChartCard>
    )
  }

  const iconForType: Record<string, typeof CalendarDays> = {
    holiday: Flag,
    birthday: Cake,
    anniversary: Award,
    event: CalendarDays,
    performance: CalendarDays,
    payroll: CalendarDays,
    leave: CalendarDays,
  }

  return (
    <ChartCard title="Upcoming">
      <div className="space-y-3">
        {items.slice(0, 5).map((item, i) => {
          const Icon = iconForType[item.type] ?? CalendarDays
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-hover">
                <Icon className="h-3.5 w-3.5 text-text-subtle" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-text truncate">{item.label}</p>
                <p className="text-[11px] text-text-subtle">
                  {format(new Date(item.date), 'EEE, d MMM')}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}
