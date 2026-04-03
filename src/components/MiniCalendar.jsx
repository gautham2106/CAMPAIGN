import { useState } from 'react'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function MiniCalendar({ value, onChange, markedDates = [] }) {
  const today = new Date().toISOString().split('T')[0]
  const [view, setView] = useState(() => {
    const d = value ? new Date(value + 'T12:00:00') : new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const { year, month } = view
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function prevMonth() {
    setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
  }
  function nextMonth() {
    setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })
  }

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function ds(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 text-gray-500 text-lg transition-colors">‹</button>
        <span className="text-sm font-bold text-gray-900">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 text-gray-500 text-lg transition-colors">›</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const dateStr = ds(d)
          const isSelected = dateStr === value
          const isToday = dateStr === today
          const hasContent = markedDates.includes(dateStr)
          const isFuture = dateStr > today

          return (
            <button
              key={i}
              onClick={() => !isFuture && onChange(dateStr)}
              disabled={isFuture}
              className={`relative flex flex-col items-center justify-center h-10 rounded-xl text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-md'
                  : isToday
                  ? 'ring-2 ring-indigo-400 text-indigo-700 bg-indigo-50'
                  : isFuture
                  ? 'text-gray-200 cursor-default'
                  : 'hover:bg-gray-100 active:bg-gray-200 text-gray-700'
              }`}
            >
              <span>{d}</span>
              {hasContent && (
                <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white/60' : 'bg-indigo-400'}`} />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-gray-400 border-t pt-3">
        <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400" /> has content</span>
        <button onClick={() => onChange(today)} className="ml-auto text-indigo-600 font-medium">Today</button>
      </div>
    </div>
  )
}
