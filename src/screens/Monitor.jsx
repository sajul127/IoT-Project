import { MetricCard } from "../components/MetricCard";
import { BarsIcon, MicIcon, ShieldIcon } from "../icons";
import { getModeLabel, getStatusLabel } from "../services/flaskApi";

export function Monitor({
  connection,
  latestEvent,
  waveform,
  spectrum,
  onModeChange,
  isChangingMode,
}) {
  const currentMode = latestEvent?.mode;
  const connectionClass = {
    online: "bg-[#ecfdf5] text-[#047857]",
    error: "bg-[#fef2f2] text-[#b91c1c]",
    connecting: "bg-[#eff6ff] text-[#1e3a8a]",
  }[connection?.status ?? "connecting"];

  return (
    <div className="grid gap-3.5">
      <section className="grid grid-cols-[34px_1fr_auto] items-center gap-3 rounded-lg border border-[#a6c4ff] bg-[#f8fbff] p-3.5">
        <MicIcon />
        <div>
          <p className="mb-1 mt-0 text-xs font-bold opacity-85">현재 모드</p>
          <strong className="text-sm text-[#111827]">
            {getModeLabel(latestEvent)}{" "}
            <span className="font-bold text-[#64748b]">(실시간 감지)</span>
          </strong>
        </div>
        <div
          className="grid grid-cols-[repeat(2,minmax(58px,1fr))] gap-1.5"
          aria-label="모니터링 모드 변경"
        >
          <button
            type="button"
            className={`h-[38px] cursor-pointer rounded-lg border text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-65 ${
              currentMode === "baby"
                ? "border-[#2563eb] bg-[#2563eb] text-white"
                : "border-[#cfe0fb] bg-white text-[#2563eb]"
            }`}
            disabled={isChangingMode}
            onClick={() => onModeChange?.("baby")}
          >
            아기
          </button>
          <button
            type="button"
            className={`h-[38px] cursor-pointer rounded-lg border text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-65 ${
              currentMode === "elderly"
                ? "border-[#2563eb] bg-[#2563eb] text-white"
                : "border-[#cfe0fb] bg-white text-[#2563eb]"
            }`}
            disabled={isChangingMode}
            onClick={() => onModeChange?.("elderly")}
          >
            독거노인
          </button>
        </div>
      </section>

      <div
        className={`rounded-lg px-3 py-2.5 text-xs font-extrabold ${connectionClass}`}
      >
        {connection?.message ?? "라즈베리파이 연결 중"}
      </div>

      {/* 4개 카드 통합 */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={BarsIcon}
          label="모드"
          value={getModeLabel(latestEvent)}
          accent="violet"
        />

        <MetricCard
          icon={ShieldIcon}
          label="감지 상태"
          value={getStatusLabel(latestEvent)}
          accent="green"
        />

        <MetricCard
          icon={MicIcon}
          label="음향 상태"
          value={latestEvent?.soundStatus ?? "Normal"}
          accent="green"
        />

        <MetricCard
          icon={MicIcon}
          label="음압"
          value={`${latestEvent?.soundLevelDb ?? 0} dB`}
          accent="violet"
        />

        <MetricCard
          icon={ShieldIcon}
          label="SOS"
          value={latestEvent?.sos ? "SOS 버튼" : "정상"}
          accent="green"
        />
      </div>
    </div>
  );
}
