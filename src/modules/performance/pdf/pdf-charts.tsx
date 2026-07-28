/**
 * PDF-native bar chart using @react-pdf/renderer primitives.
 * Renders horizontal bars using flexbox width proportions.
 */
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { CHART_COLORS } from '@/core/ui/charts/palette'

export interface PdfBarChartDataPoint {
  label: string
  value: number
  colorIndex?: number
}

interface PdfBarChartProps {
  data: PdfBarChartDataPoint[]
  maxValue?: number
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    width: 100,
    fontSize: 8,
    color: '#555555',
  },
  barContainer: {
    flex: 1,
    height: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  bar: {
    height: '100%',
    borderRadius: 2,
  },
  value: {
    width: 30,
    fontSize: 8,
    textAlign: 'right',
    color: '#333333',
    fontFamily: 'Helvetica-Bold',
  },
})

export function PdfBarChart({ data, maxValue }: PdfBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1)

  return (
    <View style={styles.container}>
      {data.map((item, i) => {
        const widthPct = max > 0 ? (item.value / max) * 100 : 0
        const color = CHART_COLORS[item.colorIndex ?? (i % CHART_COLORS.length)]

        return (
          <View key={item.label} style={styles.row}>
            <Text style={styles.label}>{item.label}</Text>
            <View style={styles.barContainer}>
              <View
                style={[
                  styles.bar,
                  { width: `${widthPct}%`, backgroundColor: color },
                ]}
              />
            </View>
            <Text style={styles.value}>{item.value}</Text>
          </View>
        )
      })}
    </View>
  )
}
