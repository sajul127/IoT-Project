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

      <section className="min-h-40 rounded-lg border border-[#e0e7f0] bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 className="m-0 text-sm font-extrabold text-[#111827]">
            실시간 음성 파형 ({latestEvent?.soundLevelDb ?? 0} dB)
          </h2>
          <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold text-[#64748b]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#10b981]" />
            실시간 수집 중
          </div>
        </div>

        <div
          className="flex h-20 items-center gap-1 pt-2"
          aria-label="실시간 음성 파형"
        >
          {waveform.map((height, index) => (
            <i
              className="min-w-0.5 flex-1 rounded-full bg-[#10b981]"
              key={index}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </section>

      <section className="min-h-40 rounded-lg border border-[#e0e7f0] bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
        <h2 className="m-0 text-sm font-extrabold text-[#111827]">
          주파수 스펙트럼 ({latestEvent?.soundStatus ?? "Normal"})
        </h2>

        <div
          className="relative mt-3.5 h-[130px] bg-[repeating-linear-gradient(to_right,transparent_0,transparent_39px,#e9eef5_40px),linear-gradient(#fff,#fff)] py-1.5 pl-[30px] pr-0 pb-[22px]"
          aria-label="주파수 스펙트럼"
        >
          <div className="absolute bottom-5 left-0 top-0 flex flex-col justify-between text-[10px] text-[#64748b]">
            <span>0</span>
            <span>-20</span>
            <span>-40</span>
            <span>-60</span>
            <span>-80</span>
          </div>

          <div className="flex h-full items-end gap-0.5">
            {spectrum.map((height, index) => (
              <i
                className="flex-1 rounded-t-sm bg-linear-to-b from-[#7c3aed] via-[#3b82f6] via-55% to-[#93c5fd]"
                key={index}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>

          <div className="absolute bottom-0 left-[30px] right-0 flex justify-between text-[10px] text-[#64748b]">
            <span>0</span>
            <span>1k</span>
            <span>2k</span>
            <span>3k</span>
            <span>4k</span>
            <span>5k</span>
          </div>
        </div>
      </section>

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
