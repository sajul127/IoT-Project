import { tabs } from '../data/monitoringData'
import { BellIcon } from '../icons'

export function AppHeader({ activeTab, unreadCount, onAlertClick }) {
  const title = tabs.find((tab) => tab.id === activeTab)?.label ?? '대시보드'
  const ariaLabel = unreadCount > 0
    ? `읽지 않은 알림 ${unreadCount}개 열기`
    : '알림 내역 열기'

  return (
    <header className="app-header">
      <h1>{title}</h1>
      <button className="icon-button notification" aria-label={ariaLabel} onClick={onAlertClick}>
        <BellIcon />
        {unreadCount > 0 && <span>{unreadCount}</span>}
      </button>
    </header>
  )
}
