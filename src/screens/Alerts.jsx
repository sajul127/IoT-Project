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
    <div className="stack">
      <div className="filter-tabs">
        {FILTERS.map((filter) => (
          <button
            className={activeFilter === filter.id ? 'active' : ''}
            key={filter.id}
            type="button"
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="alert-list">
        {filteredAlerts.length === 0 && (
          <div className="empty-alerts">해당 알림 내역이 없습니다.</div>
        )}

        {filteredAlerts.map((alert) => {
          const Icon = alert.icon
          return (
            <article
              className={`alert-card ${alert.tone} ${alert.unread ? 'unread' : ''}`}
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
                <strong>{alert.title}</strong>
                <time>{alert.time}</time>
              </div>
              <ChevronRightIcon />
            </article>
          )
        })}
      </div>
    </div>
  )
}
