import { MetricCard } from '../components/MetricCard'
import { activities } from '../data/monitoringData'
import { ArrowRightIcon, BabyIcon, BarsIcon, ShieldIcon } from '../icons'
import { getDistance, getLastUpdate, getModeLabel, getStatusLabel } from '../services/flaskApi'

export function Dashboard({
  activities: liveActivities = activities,
  connection,
  device,
  latestEvent,
  onDetailClick,
  onViewAllActivities,
}) {
  const statusLabel = getStatusLabel(latestEvent)
  const isSafe = statusLabel === '정상 상태'
  const connectionClass = {
    online: 'bg-[#ecfdf5] text-[#047857]',
    error: 'bg-[#fef2f2] text-[#b91c1c]',
    connecting: 'bg-[#eff6ff] text-[#1e3a8a]',
  }[connection?.status ?? 'connecting']

  return (
    <div className="grid gap-3.5">
      <section
        className={`flex min-h-28 items-center gap-[18px] rounded-lg p-[22px] text-white shadow-[0_12px_24px_rgba(16,185,129,0.22)] ${
          isSafe
            ? 'bg-linear-135 from-[#10b981] to-[#34d399]'
            : 'bg-linear-135 from-[#ef4444] to-[#fb7185] shadow-[0_12px_24px_rgba(239,68,68,0.2)]'
        } [&_svg]:h-[54px] [&_svg]:w-[54px]`}
      >
        <ShieldIcon />
        <div>
          <p className="mb-1 mt-0 text-xs font-bold opacity-85">현재 상태</p>
          <strong className="mb-1.5 block text-[28px] leading-none">{statusLabel}</strong>
          <small className="block text-[11px] opacity-90">
            마지막 업데이트: {getLastUpdate(device, latestEvent)}
          </small>
        </div>
      </section>

      <div className={`rounded-lg px-3 py-2.5 text-xs font-extrabold ${connectionClass}`}>
        {connection?.message ?? '라즈베리파이 연결 중'}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={BabyIcon} label="모니터링 모드" value={getModeLabel(latestEvent)} />
        <MetricCard icon={BarsIcon} label="거리" value={getDistance(latestEvent)} accent="violet" />
      </div>

      <section className="rounded-lg border border-[#e0e7f0] bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 className="m-0 text-sm font-extrabold text-[#111827]">최근 활동</h2>
          <button
            className="cursor-pointer border-0 bg-transparent text-xs font-extrabold text-[#2563eb]"
            type="button"
            onClick={onViewAllActivities}
          >
            전체 보기
          </button>
        </div>
        <div className="grid">
          {liveActivities.map((item) => (
            <div
              className="grid min-h-[42px] grid-cols-[minmax(118px,auto)_18px_1fr] items-center gap-x-1.5 border-t border-[#eef2f7] text-xs text-[#64748b]"
              key={`${item.time}-${item.status}`}
            >
              <span className="whitespace-nowrap">{item.time}</span>
              <i
                className={`h-2 w-2 rounded-full ${
                  item.type === 'danger'
                    ? 'bg-[#ef4444] shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
                    : 'bg-[#10b981]'
                }`}
              />
              <strong className={item.type === 'danger' ? 'font-bold text-[#ef4444]' : 'font-bold text-[#334155]'}>
                {item.status}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <button
        className="flex h-[54px] cursor-pointer items-center justify-center gap-[54px] rounded-lg border border-[#cfe0fb] bg-linear-to-b from-[#f8fbff] to-[#eef6ff] font-extrabold text-[#2563eb] [&_svg]:h-5 [&_svg]:w-5"
        type="button"
        onClick={onDetailClick}
      >
        상세 모니터링 보기
        <ArrowRightIcon />
      </button>
    </div>
  )
}
