'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import dagre from 'dagre'
import { useRouter } from 'next/navigation'
import '@xyflow/react/dist/style.css'

// ── Types ───────────────────────────────────────────────────────────────────

interface OrgChartNode {
  id: string
  firstName: string
  lastName: string
  jobTitle: string | null
  department: string | null
  directReports: OrgChartNode[]
}

interface EmployeeNodeData {
  firstName: string
  lastName: string
  jobTitle: string | null
  department: string | null
  directReportCount: number
  orgSlug: string
  [key: string]: unknown
}

// ── Layout helpers ──────────────────────────────────────────────────────────

const NODE_WIDTH = 220
const NODE_HEIGHT = 80

function getLayoutedElements(
  nodes: Node<EmployeeNodeData>[],
  edges: Edge[]
): { nodes: Node<EmployeeNodeData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 })

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id)
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

// ── Flatten tree into nodes & edges ─────────────────────────────────────────

function flattenTree(
  tree: OrgChartNode[],
  orgSlug: string
): { nodes: Node<EmployeeNodeData>[]; edges: Edge[] } {
  const nodes: Node<EmployeeNodeData>[] = []
  const edges: Edge[] = []

  function walk(node: OrgChartNode) {
    nodes.push({
      id: node.id,
      type: 'employee',
      position: { x: 0, y: 0 },
      data: {
        firstName: node.firstName,
        lastName: node.lastName,
        jobTitle: node.jobTitle,
        department: node.department,
        directReportCount: node.directReports.length,
        orgSlug,
      },
    })

    for (const child of node.directReports) {
      edges.push({
        id: `${node.id}-${child.id}`,
        source: node.id,
        target: child.id,
        type: 'smoothstep',
        style: { stroke: 'var(--color-border)', strokeWidth: 1.5 },
      })
      walk(child)
    }
  }

  for (const root of tree) {
    walk(root)
  }

  return { nodes, edges }
}

// ── Custom node ─────────────────────────────────────────────────────────────

function EmployeeNode({ data, id }: NodeProps<Node<EmployeeNodeData>>) {
  const [hovered, setHovered] = useState(false)
  const router = useRouter()
  const { getNode, getEdges } = useReactFlow()

  const initials = `${data.firstName[0] ?? ''}${data.lastName[0] ?? ''}`.toUpperCase()

  const handleClick = useCallback(() => {
    router.push(`/${data.orgSlug}/employees/${id}`)
  }, [router, data.orgSlug, id])

  // Highlight connected edges visually via className
  const connectedInfo = useMemo(() => {
    if (!hovered) return null
    const edges = getEdges()
    const managerEdge = edges.find((e) => e.target === id)
    const reportEdges = edges.filter((e) => e.source === id)
    const managerNode = managerEdge ? getNode(managerEdge.source) : null
    return {
      managerName: managerNode
        ? `${(managerNode.data as EmployeeNodeData).firstName} ${(managerNode.data as EmployeeNodeData).lastName}`
        : null,
      reportCount: reportEdges.length,
    }
  }, [hovered, id, getEdges, getNode])

  return (
    <div
      className={`
        relative flex items-center gap-3 rounded-[var(--radius-md)] border bg-surface px-3 py-2.5
        cursor-pointer transition-all select-none
        ${hovered ? 'border-accent-500 shadow-md ring-1 ring-accent-200' : 'border-border hover:border-accent-300'}
      `}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${data.firstName} ${data.lastName}${data.jobTitle ? `, ${data.jobTitle}` : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-none !w-0 !h-0" />

      {/* Avatar */}
      <div
        className={`
          flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-medium
          ${data.department ? 'bg-accent-50 text-accent-700' : 'bg-surface-hover text-text-muted'}
        `}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-text">
          {data.firstName} {data.lastName}
        </p>
        {data.jobTitle && (
          <p className="truncate text-[11px] text-text-muted">{data.jobTitle}</p>
        )}
        {data.department && (
          <p className="truncate text-[10px] text-text-subtle">{data.department}</p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-none !w-0 !h-0" />

      {/* Hover popover */}
      {hovered && (
        <div
          className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 shadow-lg"
          style={{ minWidth: 180 }}
        >
          <p className="text-[12px] font-medium text-text">
            {data.firstName} {data.lastName}
          </p>
          {data.jobTitle && (
            <p className="text-[11px] text-text-muted">{data.jobTitle}</p>
          )}
          {data.department && (
            <p className="text-[11px] text-text-subtle">Dept: {data.department}</p>
          )}
          <p className="mt-1 text-[11px] text-text-muted">
            Direct reports: {data.directReportCount}
          </p>
          {connectedInfo?.managerName && (
            <p className="text-[11px] text-text-muted">
              Manager: {connectedInfo.managerName}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  employee: EmployeeNode,
}

interface OrgChartFlowProps {
  nodes: OrgChartNode[]
  orgSlug: string
}

function OrgChartFlowInner({ nodes, orgSlug }: OrgChartFlowProps) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    const { nodes: flatNodes, edges } = flattenTree(nodes, orgSlug)
    return getLayoutedElements(flatNodes, edges)
  }, [nodes, orgSlug])

  return (
    <div className="h-[600px] w-full rounded-[var(--radius-md)] border border-border bg-surface">
      <ReactFlow
        nodes={layoutedNodes}
        edges={layoutedEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable={false}
      />
    </div>
  )
}

export function OrgChartFlow({ nodes, orgSlug }: OrgChartFlowProps) {
  return (
    <ReactFlowProvider>
      <OrgChartFlowInner nodes={nodes} orgSlug={orgSlug} />
    </ReactFlowProvider>
  )
}
