import { tabs } from '../data/monitoringData'

export function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="하단 내비게이션">
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            className={activeTab === tab.id ? 'active' : ''}
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
