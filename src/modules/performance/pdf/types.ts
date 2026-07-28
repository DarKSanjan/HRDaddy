/**
 * Types for performance review PDF generation.
 */

export interface ReviewEmployeeData {
  reviewId: string
  employeeId: string
  firstName: string
  lastName: string
  jobTitle: string | null
  department: string | null
  overallScore: number
  strengths: string | null
  improvements: string | null
  goals: string | null
  selfAssessment: string | null
  reviewerName: string | null
  publishedAt: Date | null
  acknowledgedAt?: Date | null
  competencyScores: Array<{
    competency: string
    score: number
  }>
  autoMetrics: {
    attendanceReliability: number
    lateArrivals: number
    leaveDaysTaken: number
    totalHoursWorked: number
    overtimeHours: number
  }
}

export interface ReviewPdfData {
  orgName: string
  logoUrl: string | null
  cycleName: string
  cycleStart: Date
  cycleEnd: Date
  employees: ReviewEmployeeData[]
  summary?: ReviewSummaryData
}

export interface ReviewSummaryData {
  totalReviewed: number
  averageScore: number
  distribution: Record<number, number> // score → count (1–5)
  aggregateMetrics: {
    totalLeaveDays: number
    averageAttendance: number
    totalOvertimeHours: number
    averageHoursWorked: number
  }
}
