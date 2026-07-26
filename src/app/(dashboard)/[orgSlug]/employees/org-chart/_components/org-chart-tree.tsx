'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, User } from 'lucide-react'

interface OrgChartNode {
  id: string
  firstName: string
  lastName: string
  jobTitle: string | null
  department: string | null
  directReports: OrgChartNode[]
}

interface OrgChartTreeProps {
  nodes: OrgChartNode[]
  orgSlug: string
}

export function OrgChartTree({ nodes, orgSlug }: OrgChartTreeProps) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <ul className="space-y-1" role="tree">
        {nodes.map((node) => (
          <OrgChartNodeItem key={node.id} node={node} orgSlug={orgSlug} level={0} />
        ))}
      </ul>
    </div>
  )
}

function OrgChartNodeItem({
  node,
  orgSlug,
  level,
}: {
  node: OrgChartNode
  orgSlug: string
  level: number
}) {
  const hasReports = node.directReports.length > 0
  const [expanded, setExpanded] = useState(level < 2)

  return (
    <li role="treeitem" aria-selected={false} aria-expanded={hasReports ? expanded : undefined}>
      <div
        className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-2 hover:bg-surface-hover transition-colors"
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        {/* Expand/collapse toggle */}
        {hasReports ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-xs)] text-text-muted hover:bg-surface-hover"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Avatar placeholder */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <User className="h-4 w-4" aria-hidden="true" />
        </div>

        {/* Name and title */}
        <div className="min-w-0 flex-1">
          <Link
            href={`/${orgSlug}/employees/${node.id}`}
            className="text-[13px] font-medium text-text hover:text-accent-500 transition-colors"
          >
            {node.firstName} {node.lastName}
          </Link>
          <div className="flex items-center gap-2">
            {node.jobTitle && (
              <span className="text-[11px] text-text-muted">{node.jobTitle}</span>
            )}
            {node.department && (
              <span className="text-[11px] text-text-subtle">
                {node.jobTitle ? ' · ' : ''}{node.department}
              </span>
            )}
          </div>
        </div>

        {/* Reports count badge */}
        {hasReports && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface-hover px-1.5 text-[10px] font-medium text-text-muted">
            {node.directReports.length}
          </span>
        )}
      </div>

      {/* Children */}
      {hasReports && expanded && (
        <ul className="mt-0.5" role="group">
          {node.directReports.map((child) => (
            <OrgChartNodeItem
              key={child.id}
              node={child}
              orgSlug={orgSlug}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
