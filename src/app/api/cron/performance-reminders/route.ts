import { NextRequest, NextResponse } from 'next/server'
import { sendPerformanceReminders } from '@/modules/performance/reminders'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    // Fail closed: without this check, an unset CRON_SECRET makes the expected
    // value the literal string "Bearer undefined", which is a guessable bypass.
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await sendPerformanceReminders()
  return NextResponse.json(result)
}
