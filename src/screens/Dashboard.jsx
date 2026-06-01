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

  return (
    <div className="stack">
      <section className={`hero-card ${isSafe ? 'safe' : 'danger'}`}>
        <ShieldIcon />
        <div>
          <p>현재 상태</p>
          <strong>{statusLabel}</strong>
          <small>마지막 업데이트: {getLastUpdate(device, latestEvent)}</small>
        </div>
      </section>

      <div className={`connection-banner ${connection?.status ?? 'connecting'}`}>
        {connection?.message ?? '라즈베리파이 연결 중'}
      </div>

      <div className="metric-grid">
        <MetricCard icon={BabyIcon} label="모니터링 모드" value={getModeLabel(latestEvent)} />
        <MetricCard icon={BarsIcon} label="거리" value={getDistance(latestEvent)} accent="violet" />
      </div>

      <section className="panel">
        <div className="panel-title">
          <h2>최근 활동</h2>
          <button type="button" onClick={onViewAllActivities}>전체 보기</button>
        </div>
        <div className="activity-list">
          {liveActivities.map((item) => (
            <div className="activity-row" key={`${item.time}-${item.status}`}>
              <span>{item.time}</span>
              <i className={item.type} />
              <strong className={item.type}>{item.status}</strong>
            </div>
          ))}
        </div>
      </section>

      <button className="detail-button" type="button" onClick={onDetailClick}>
        상세 모니터링 보기
        <ArrowRightIcon />
      </button>
    </div>
  )
}
