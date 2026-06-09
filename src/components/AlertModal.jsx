import { AlertIcon } from "../icons";

export function AlertModal({
  alert,
  remainingCount,
  onClose,
  onViewDetail,
  onConfirm,
  requiresConfirm = false,
  isConfirming = false,
}) {
  if (!alert) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-10 grid place-items-center bg-[#0f172a]/70 p-6"
      role="presentation"
    >
      <section
        className="w-full max-w-[270px] rounded-lg bg-white px-[22px] pb-[18px] pt-7 text-center shadow-[0_18px_44px_rgba(0,0,0,0.28)]"
        role="dialog"
        aria-modal="true"
        aria-label={alert.title}
      >
        <div className="mx-auto mb-3 grid h-[54px] w-[54px] place-items-center rounded-full bg-[#ef4444] text-white [&_svg]:h-[30px] [&_svg]:w-[30px]">
          <AlertIcon />
        </div>
        <h2 className="mb-2 mt-0 text-xl text-[#ef4444]">{alert.title}</h2>
        <p className="mb-3 mt-0 text-sm text-[#475569]">
          {alert.message}

          {alert.babyCryScore != null && (
            <span className="ml-1 font-bold text-[#ef4444]">
              ({alert.babyCryScore}%)
            </span>
          )}
        </p>
        <dl className="mb-4 mt-0 text-left text-[13px] text-[#334155]">
          <div className="flex justify-center gap-1.5">
            <dt>시간:</dt>
            <dd className="m-0">{alert.time}</dd>
          </div>
          <div className="flex justify-center gap-1.5">
            <dt>장소:</dt>
            <dd className="m-0">{alert.location}</dd>
          </div>
        </dl>
        {remainingCount > 0 && (
          <small className="-mt-1 mb-3.5 block text-xs font-extrabold text-[#ef4444]">
            남은 알림 {remainingCount}개
          </small>
        )}
        <button
          className="h-10 w-full cursor-pointer rounded-lg border-0 bg-[#ef4444] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-65"
          type="button"
          onClick={onViewDetail}
          disabled={isConfirming}
        >
          상세 보기
        </button>
        <button
          className="mt-2 h-10 w-full cursor-pointer rounded-lg border border-[#e2e8f0] bg-white font-extrabold text-[#334155] disabled:cursor-not-allowed disabled:opacity-65"
          type="button"
          onClick={requiresConfirm ? onConfirm : onClose}
          disabled={isConfirming}
        >
          확인
        </button>
      </section>
    </div>
  );
}
