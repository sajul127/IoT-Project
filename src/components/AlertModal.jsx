import { AlertIcon } from '../icons'

export function AlertModal({
  alert,
  remainingCount,
  onClose,
  onViewDetail,
  onConfirm,
  isConfirming = false,
}) {
  if (!alert) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="alert-modal" role="dialog" aria-modal="true" aria-label={alert.title}>
        <div className="modal-icon">
          <AlertIcon />
        </div>
        <h2>{alert.title}</h2>
        <p>{alert.message}</p>
        <dl>
          <div>
            <dt>시간:</dt>
            <dd>{alert.time}</dd>
          </div>
          <div>
            <dt>장소:</dt>
            <dd>{alert.location}</dd>
          </div>
        </dl>
        {remainingCount > 0 && (
          <small className="remaining-alerts">남은 알림 {remainingCount}개</small>
        )}
        <button className="danger-button" type="button" onClick={onViewDetail} disabled={isConfirming}>
          상세 보기
        </button>
        <button
          className="close-button"
          type="button"
          onClick={alert.raw?.sos ? onConfirm : onClose}
          disabled={isConfirming}
        >
          확인
        </button>
      </section>
    </div>
  )
}
