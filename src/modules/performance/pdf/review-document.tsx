/**
 * Performance Review PDF Document — renders review pages for one or more employees
 * using @react-pdf/renderer (server-side only).
 */
import fs from 'node:fs'
import path from 'node:path'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ReviewPdfData, ReviewEmployeeData } from './types'
import { PdfBarChart } from './pdf-charts'

// Read the real logo PNG once at module load (server-only file)
const logoBuffer = fs.readFileSync(path.join(process.cwd(), 'public/logo.png'))
const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`

const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Below Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
  5: 'Outstanding',
}

const COMPETENCY_LABELS: Record<string, string> = {
  JOB_KNOWLEDGE: 'Job Knowledge',
  QUALITY_OF_WORK: 'Quality of Work',
  COMMUNICATION: 'Communication',
  TEAMWORK: 'Teamwork',
  INITIATIVE: 'Initiative',
  RELIABILITY: 'Reliability',
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingBottom: 16,
  },
  orgName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  logo: {
    width: 60,
    height: 60,
    objectFit: 'contain' as const,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    marginTop: 12,
    color: '#333333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: {
    fontSize: 9,
  },
  rowValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  totalLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  totalValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  metricsSection: {
    marginTop: 16,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 0.5,
    borderColor: '#e5e5e5',
    borderRadius: 4,
  },
  metricsTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: '#333333',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  metricsLabel: {
    fontSize: 9,
    color: '#555555',
  },
  metricsValue: {
    fontSize: 9,
  },
  textBlock: {
    marginTop: 8,
  },
  textLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#666666',
    marginBottom: 3,
  },
  textContent: {
    fontSize: 9,
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 7,
    color: '#999999',
  },
  poweredBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
})

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function SummaryPage({ data }: { data: ReviewPdfData }) {
  const summary = data.summary!
  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.orgName}>{data.orgName}</Text>
          <Text style={{ fontSize: 8, color: '#666666', marginTop: 4 }}>
            Performance Review Summary
          </Text>
        </View>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF Image component does not support alt */}
        {data.logoUrl && <Image src={data.logoUrl} style={styles.logo} />}
      </View>

      {/* Cycle info */}
      <Text style={styles.title}>{data.cycleName}</Text>
      <Text style={styles.subtitle}>
        Review Period: {formatDate(data.cycleStart)} — {formatDate(data.cycleEnd)}
      </Text>

      {/* Overview Totals */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Total Employees Reviewed</Text>
        <Text style={styles.rowValue}>{summary.totalReviewed}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Average Overall Score</Text>
        <Text style={styles.rowValue}>
          {summary.averageScore.toFixed(1)}/5 ({RATING_LABELS[Math.round(summary.averageScore)] ?? '—'})
        </Text>
      </View>

      {/* Score Distribution */}
      <Text style={{ ...styles.sectionTitle, marginTop: 20 }}>Score Distribution</Text>
      <PdfBarChart
        data={[5, 4, 3, 2, 1].map((score) => ({
          label: `${score} — ${RATING_LABELS[score]}`,
          value: summary.distribution[score] ?? 0,
        }))}
      />

      {/* Aggregate attendance/leave/OT metrics */}
      <View style={styles.metricsSection}>
        <Text style={styles.metricsTitle}>Org-Wide Attendance &amp; Leave (Cycle Period)</Text>
        <View style={styles.metricsRow}>
          <Text style={styles.metricsLabel}>Average Attendance Reliability</Text>
          <Text style={styles.metricsValue}>{summary.aggregateMetrics.averageAttendance}%</Text>
        </View>
        <View style={styles.metricsRow}>
          <Text style={styles.metricsLabel}>Total Leave Days Taken</Text>
          <Text style={styles.metricsValue}>{summary.aggregateMetrics.totalLeaveDays} days</Text>
        </View>
        <View style={styles.metricsRow}>
          <Text style={styles.metricsLabel}>Total Overtime Hours</Text>
          <Text style={styles.metricsValue}>{summary.aggregateMetrics.totalOvertimeHours}h</Text>
        </View>
        <View style={styles.metricsRow}>
          <Text style={styles.metricsLabel}>Average Hours Worked Per Employee</Text>
          <Text style={styles.metricsValue}>{summary.aggregateMetrics.averageHoursWorked}h</Text>
        </View>
      </View>

      {/* Employee list */}
      <Text style={{ ...styles.sectionTitle, marginTop: 20 }}>Employee Scores</Text>
      {data.employees.map((emp, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.rowLabel}>{emp.firstName} {emp.lastName}</Text>
          <Text style={styles.rowValue}>
            {emp.overallScore}/5 — {RATING_LABELS[emp.overallScore] ?? '—'}
          </Text>
        </View>
      ))}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Performance review summary — generated by HRDaddy
        </Text>
        <View style={styles.poweredBy}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF Image component does not support alt */}
          <Image src={logoBase64} style={{ width: 14, height: 14 }} />
          <Text style={{ fontSize: 7, color: '#6758FF' }}>Powered by HRDaddy</Text>
        </View>
      </View>
    </Page>
  )
}

function EmployeePage({ employee, data }: { employee: ReviewEmployeeData; data: ReviewPdfData }) {
  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.orgName}>{data.orgName}</Text>
          <Text style={{ fontSize: 8, color: '#666666', marginTop: 4 }}>Performance Review</Text>
        </View>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF Image component does not support alt */}
        {data.logoUrl && <Image src={data.logoUrl} style={styles.logo} />}
      </View>

      {/* Cycle + Employee */}
      <Text style={styles.title}>{data.cycleName}</Text>
      <Text style={styles.subtitle}>
        Review Period: {formatDate(data.cycleStart)} — {formatDate(data.cycleEnd)}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
        <View style={{ width: '33%', marginBottom: 8 }}>
          <Text style={{ fontSize: 8, color: '#666666', marginBottom: 2 }}>Employee</Text>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>
            {employee.firstName} {employee.lastName}
          </Text>
        </View>
        {employee.jobTitle && (
          <View style={{ width: '33%', marginBottom: 8 }}>
            <Text style={{ fontSize: 8, color: '#666666', marginBottom: 2 }}>Job Title</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{employee.jobTitle}</Text>
          </View>
        )}
        {employee.department && (
          <View style={{ width: '33%', marginBottom: 8 }}>
            <Text style={{ fontSize: 8, color: '#666666', marginBottom: 2 }}>Department</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{employee.department}</Text>
          </View>
        )}
        {employee.reviewerName && (
          <View style={{ width: '33%', marginBottom: 8 }}>
            <Text style={{ fontSize: 8, color: '#666666', marginBottom: 2 }}>Reviewer</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{employee.reviewerName}</Text>
          </View>
        )}
        {employee.publishedAt && (
          <View style={{ width: '33%', marginBottom: 8 }}>
            <Text style={{ fontSize: 8, color: '#666666', marginBottom: 2 }}>Published</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>
              {formatDate(employee.publishedAt)}
            </Text>
          </View>
        )}
      </View>

      {/* Overall Score */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Overall Score</Text>
        <Text style={styles.totalValue}>
          {employee.overallScore}/5 — {RATING_LABELS[employee.overallScore] ?? '—'}
        </Text>
      </View>

      {/* Competency Breakdown */}
      {employee.competencyScores.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Competency Breakdown</Text>
          <PdfBarChart
            data={employee.competencyScores.map((cs) => ({
              label: COMPETENCY_LABELS[cs.competency] ?? cs.competency,
              value: cs.score,
            }))}
            maxValue={5}
          />
        </View>
      )}

      {/* Auto-Metrics */}
      <View style={styles.metricsSection}>
        <Text style={styles.metricsTitle}>Attendance &amp; Productivity Metrics</Text>
        <View style={styles.metricsRow}>
          <Text style={styles.metricsLabel}>Attendance Reliability</Text>
          <Text style={styles.metricsValue}>{employee.autoMetrics.attendanceReliability}%</Text>
        </View>
        <View style={styles.metricsRow}>
          <Text style={styles.metricsLabel}>Late Arrivals</Text>
          <Text style={styles.metricsValue}>{employee.autoMetrics.lateArrivals}</Text>
        </View>
        <View style={styles.metricsRow}>
          <Text style={styles.metricsLabel}>Leave Days Taken</Text>
          <Text style={styles.metricsValue}>{employee.autoMetrics.leaveDaysTaken} days</Text>
        </View>
        <View style={styles.metricsRow}>
          <Text style={styles.metricsLabel}>Hours Worked</Text>
          <Text style={styles.metricsValue}>{employee.autoMetrics.totalHoursWorked}h</Text>
        </View>
        <View style={styles.metricsRow}>
          <Text style={styles.metricsLabel}>Overtime Hours</Text>
          <Text style={styles.metricsValue}>{employee.autoMetrics.overtimeHours}h</Text>
        </View>
      </View>

      {/* Strengths / Improvements / Goals */}
      {employee.strengths && (
        <View style={styles.textBlock}>
          <Text style={styles.textLabel}>STRENGTHS</Text>
          <Text style={styles.textContent}>{employee.strengths}</Text>
        </View>
      )}
      {employee.improvements && (
        <View style={styles.textBlock}>
          <Text style={styles.textLabel}>AREAS FOR IMPROVEMENT</Text>
          <Text style={styles.textContent}>{employee.improvements}</Text>
        </View>
      )}
      {employee.goals && (
        <View style={styles.textBlock}>
          <Text style={styles.textLabel}>GOALS FOR NEXT QUARTER</Text>
          <Text style={styles.textContent}>{employee.goals}</Text>
        </View>
      )}

      {/* Self-Assessment */}
      {employee.selfAssessment && (
        <View style={styles.textBlock}>
          <Text style={styles.textLabel}>SELF-ASSESSMENT</Text>
          <Text style={styles.textContent}>{employee.selfAssessment}</Text>
        </View>
      )}

      {/* Acknowledgment status */}
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 8, color: '#666666' }}>
          Acknowledged by employee:{' '}
          {employee.acknowledgedAt
            ? `Yes, ${formatDate(employee.acknowledgedAt)}`
            : 'Not yet acknowledged'}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Performance review — generated by HRDaddy
        </Text>
        <View style={styles.poweredBy}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF Image component does not support alt */}
          <Image src={logoBase64} style={{ width: 14, height: 14 }} />
          <Text style={{ fontSize: 7, color: '#6758FF' }}>Powered by HRDaddy</Text>
        </View>
      </View>
    </Page>
  )
}

export function ReviewDocument({ data }: { data: ReviewPdfData }) {
  return (
    <Document>
      {data.summary && <SummaryPage data={data} />}
      {data.employees.map((employee) => (
        <EmployeePage key={employee.reviewId} employee={employee} data={data} />
      ))}
    </Document>
  )
}
