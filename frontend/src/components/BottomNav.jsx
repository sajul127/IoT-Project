import { tabs } from '../data/monitoringData'

export function BottomNav({ activeTab, onChange }) {
  return (
    <nav
      className="absolute bottom-3.5 left-3.5 right-3.5 grid h-[72px] grid-cols-3 items-center rounded-lg border border-[#e0e7f0] bg-white/95 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] backdrop-blur-[10px]"
      aria-label="하단 내비게이션"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            className={`grid h-full cursor-pointer place-items-center content-center gap-1 border-0 bg-transparent text-[11px] font-bold ${
              isActive ? 'text-[#2563eb]' : 'text-[#5f6b7a]'
            } [&_svg]:h-[23px] [&_svg]:w-[23px]`}
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
          >
            <Icon />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
