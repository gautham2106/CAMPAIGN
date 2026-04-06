// All date comparisons and "today" labels use IST (UTC+5:30)
// DB timestamps (checked_at, reassigned_at etc.) use new Date().toISOString() — UTC is fine there.

export function getTodayIST() {
  // en-CA locale produces YYYY-MM-DD which matches our date column format
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// Returns a date string N days before today in IST
export function daysAgoIST(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}
