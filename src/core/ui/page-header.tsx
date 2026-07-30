import * as React from 'react'
import { Breadcrumb, type BreadcrumbItem } from './breadcrumb'

export interface PageHeaderProps {
  breadcrumbItems: BreadcrumbItem[]
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

function PageHeader({ breadcrumbItems, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      <Breadcrumb items={breadcrumbItems} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-text">{title}</h1>
          {subtitle && (
            <p className="text-[13px] text-text-muted">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export { PageHeader }
