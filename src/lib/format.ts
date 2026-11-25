const IST_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

export function formatLedgerDate(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return 'Invalid date'

  const parts = IST_DATE_FORMATTER.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''

  return `${get('month')} ${get('day')}, ${get('year')} • ${get('hour')}:${get('minute')} ${get('dayPeriod')}`
}

export function getInitials(fullName?: string | null): string {
  const cleaned = (fullName ?? '').trim()
  if (!cleaned) return 'U'
  return cleaned
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

export function isAdminCorrectionNote(note?: string | null): boolean {
  return Boolean(note?.startsWith('Correction by Admin:'))
}

