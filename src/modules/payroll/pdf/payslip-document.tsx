/**
 * Payslip PDF Document — renders a payslip page for one or more employees
 * using @react-pdf/renderer (server-side only).
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { PayslipPdfData, PayslipEmployeeData } from './types'

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
  employeeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  infoBlock: {},
  infoLabel: {
    fontSize: 8,
    color: '#666666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
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
  cpfSection: {
    marginTop: 16,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 0.5,
    borderColor: '#e5e5e5',
    borderRadius: 4,
  },
  cpfTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: '#333333',
  },
  cpfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  cpfLabel: {
    fontSize: 9,
    color: '#555555',
  },
  cpfValue: {
    fontSize: 9,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#999999',
    textAlign: 'center',
  },
})

function formatCurrency(cents: number): string {
  const amount = cents / 100
  return `$${amount.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function EmployeePage({ employee, data }: { employee: PayslipEmployeeData; data: PayslipPdfData }) {
  // Group line items by type
  const earnings = employee.lineItems.filter(
    (li) => li.type === 'EARNING' || li.type === 'ALLOWANCE' || li.type === 'OVERTIME'
  )
  const deductions = employee.lineItems.filter((li) => li.type === 'DEDUCTION')

  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.orgName}>{data.orgName}</Text>
          <Text style={{ fontSize: 8, color: '#666666', marginTop: 4 }}>Payslip</Text>
        </View>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF Image component does not support alt */}
        {data.logoUrl && <Image src={data.logoUrl} style={styles.logo} />}
      </View>

      {/* Title */}
      <Text style={styles.title}>{data.periodName}</Text>
      <Text style={styles.subtitle}>
        {formatDate(data.periodStart)} — {formatDate(data.periodEnd)}
      </Text>

      {/* Employee Info */}
      <View style={styles.employeeInfo}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Employee Name</Text>
          <Text style={styles.infoValue}>
            {employee.firstName} {employee.lastName}
          </Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Employee ID</Text>
          <Text style={styles.infoValue}>{employee.employeeId}</Text>
        </View>
      </View>

      {/* Earnings */}
      {earnings.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Earnings &amp; Allowances</Text>
          {earnings.map((li) => (
            <View key={li.id} style={styles.row}>
              <Text style={styles.rowLabel}>
                {li.name} ({li.type})
              </Text>
              <Text style={styles.rowValue}>{formatCurrency(li.amountCents)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Deductions */}
      {deductions.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Deductions</Text>
          {deductions.map((li) => (
            <View key={li.id} style={styles.row}>
              <Text style={styles.rowLabel}>{li.name}</Text>
              <Text style={styles.rowValue}>-{formatCurrency(Math.abs(li.amountCents))}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Gross Pay */}
      <View style={styles.row}>
        <Text style={{ ...styles.rowLabel, fontFamily: 'Helvetica-Bold' }}>Gross Pay</Text>
        <Text style={styles.rowValue}>{formatCurrency(employee.grossAmountCents)}</Text>
      </View>

      {/* CPF Section */}
      <View style={styles.cpfSection}>
        <Text style={styles.cpfTitle}>CPF Contributions</Text>
        <View style={styles.cpfRow}>
          <Text style={styles.cpfLabel}>Employee Contribution (deducted from gross)</Text>
          <Text style={styles.cpfValue}>-{formatCurrency(employee.cpfEmployeeCents ?? 0)}</Text>
        </View>
        <View style={styles.cpfRow}>
          <Text style={styles.cpfLabel}>Employer Contribution (informational — not deducted from net)</Text>
          <Text style={styles.cpfValue}>{formatCurrency(employee.cpfEmployerCents ?? 0)}</Text>
        </View>
      </View>

      {/* Net Pay */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Net Pay</Text>
        <Text style={styles.totalValue}>{formatCurrency(employee.netAmountCents)}</Text>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        This is a system-generated payslip. Figures are computed from configured statutory rate tables.
      </Text>
    </Page>
  )
}

export function PayslipDocument({ data }: { data: PayslipPdfData }) {
  return (
    <Document>
      {data.employees.map((employee) => (
        <EmployeePage key={employee.recordId} employee={employee} data={data} />
      ))}
    </Document>
  )
}
