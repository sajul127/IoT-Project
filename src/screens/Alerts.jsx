import { ChevronRightIcon } from '../icons'
import { useMemo, useState } from 'react'

const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'danger', label: '위험 감지' },
  { id: 'info', label: '정보' },
]

export function Alerts({ alerts, onAlertClick }) {
  const [activeFilter, setActiveFilter] = useState('all')

  const filteredAlerts = useMemo(() => {
    if (activeFilter === 'danger') {
      return alerts.filter((alert) => alert.tone !== 'safe')
    }

    if (activeFilter === 'info') {
      return alerts.filter((alert) => alert.tone === 'safe')
    }

    return alerts
  }, [activeFilter, alerts])

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-3 border-b border-[#e5eaf2]">
        {FILTERS.map((filter) => (
          <button
            className={`h-12 cursor-pointer border-0 border-b-2 bg-transparent text-sm font-extrabold ${
              activeFilter === filter.id
                ? 'border-[#2563eb] text-[#2563eb]'
                : 'border-transparent text-[#334155]'
            }`}
            key={filter.id}
            type="button"
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3.5">
        {filteredAlerts.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-7 text-center text-[13px] font-extrabold text-[#64748b]">
            해당 알림 내역이 없습니다.
          </div>
        )}

        {filteredAlerts.map((alert) => {
          const Icon = alert.icon
          const toneClass = {
            danger: 'border-[#fecaca] bg-[#fff1f2] text-[#ef4444] [&_strong]:text-[#ef4444]',
            warning: 'border-[#fed7aa] bg-[#fff7ed] text-[#f59e0b]',
            safe: 'border-[#ccfbf1] bg-[#ecfdf5] text-[#10b981]',
          }[alert.tone] ?? 'border-[#e0e7f0] bg-white text-[#2563eb]'

          return (
            <article
              className={`relative grid min-h-[86px] cursor-pointer grid-cols-[34px_1fr_22px] items-center gap-3.5 rounded-lg border p-4 outline-offset-2 focus-visible:outline-3 focus-visible:outline-[#2563eb]/30 ${
                toneClass
              } ${
                alert.unread
                  ? 'after:absolute after:right-3.5 after:top-3.5 after:h-2 after:w-2 after:rounded-full after:bg-current'
                  : ''
              } [&_svg:last-child]:h-5 [&_svg:last-child]:w-5`}
              key={alert.id}
              role="button"
              tabIndex={0}
              onClick={() => onAlertClick?.(alert.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onAlertClick?.(alert.id)
                }
              }}
            >
              <Icon />
              <div>
                <strong className="mb-1 block text-[15px] text-[#111827]">{alert.title}</strong>
                <time className="text-[13px] text-[#475569]">{alert.time}</time>
              </div>
              <ChevronRightIcon />
            </article>
          )
        })}
      </div>
    </div>
  )
}
