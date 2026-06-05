import { tabs } from '../data/monitoringData'
import { BellIcon } from '../icons'

export function AppHeader({ activeTab, unreadCount, onAlertClick }) {
  const title = tabs.find((tab) => tab.id === activeTab)?.label ?? '대시보드'
  const ariaLabel = unreadCount > 0
    ? `읽지 않은 알림 ${unreadCount}개 열기`
    : '알림 내역 열기'

  return (
    <header className="grid grid-cols-[1fr_42px] items-center px-[18px] pb-3.5 pt-4">
      <h1 className="m-0 text-left text-[17px] font-extrabold text-[#111827]">{title}</h1>
      <button
        className="relative grid h-[38px] w-[38px] cursor-pointer place-items-center rounded-xl border-0 bg-transparent text-[#1e4b86]"
        aria-label={ariaLabel}
        onClick={onAlertClick}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute right-[3px] top-[3px] grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-white bg-[#ef4444] text-[10px] font-extrabold text-white">
            {unreadCount}
          </span>
        )}
      </button>
    </header>
  )
}
