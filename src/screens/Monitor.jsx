import { MetricCard } from "../components/MetricCard";
import { BarsIcon, MicIcon, ShieldIcon } from "../icons";
import {
  getDistance,
  getModeLabel,
  getStatusLabel,
} from "../services/flaskApi";

export function Monitor({
  connection,
  latestEvent,
  waveform,
  spectrum,
  onModeChange,
  isChangingMode,
}) {
  const currentMode = latestEvent?.mode;

  return (
    <div className="stack">
      <section className="mode-card">
        <MicIcon />
        <div>
          <p>현재 모드</p>
          <strong>
            {getModeLabel(latestEvent)} <span>(실시간 감지)</span>
          </strong>
        </div>
        <div className="mode-actions" aria-label="모니터링 모드 변경">
          <button
            type="button"
            className={currentMode === "baby" ? "active" : ""}
            disabled={isChangingMode}
            onClick={() => onModeChange?.("baby")}
          >
            아기
          </button>
          <button
            type="button"
            className={currentMode === "elderly" ? "active" : ""}
            disabled={isChangingMode}
            onClick={() => onModeChange?.("elderly")}
          >
            독거노인
          </button>
        </div>
      </section>

      <div
        className={`connection-banner ${connection?.status ?? "connecting"}`}
      >
        {connection?.message ?? "라즈베리파이 연결 중"}
      </div>

      <section className="panel chart-panel">
        <div className="panel-title">
          <h2>실시간 음성 파형 ({latestEvent?.soundLevelDb ?? 0} dB)</h2>
          <div className="live-dot">
            <span />
            실시간 수집 중
          </div>
        </div>

        <div className="waveform" aria-label="실시간 음성 파형">
          {waveform.map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </div>
      </section>

      <section className="panel chart-panel">
        <h2>주파수 스펙트럼 ({latestEvent?.soundStatus ?? "Normal"})</h2>

        <div className="spectrum" aria-label="주파수 스펙트럼">
          <div className="axis y-axis">
            <span>0</span>
            <span>-20</span>
            <span>-40</span>
            <span>-60</span>
            <span>-80</span>
          </div>

          <div className="spectrum-bars">
            {spectrum.map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ))}
          </div>

          <div className="axis x-axis">
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
      <div className="metric-grid">
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
          icon={BarsIcon}
          label="거리"
          value={getDistance(latestEvent)}
          accent="violet"
        />

        <MetricCard
          icon={ShieldIcon}
          label="SOS"
          value={latestEvent?.sos ? "감지됨" : "정상"}
          accent="green"
        />

        <MetricCard
          icon={MicIcon}
          label="음압"
          value={`${latestEvent?.soundLevelDb ?? 0} dB`}
          accent="violet"
        />

        <MetricCard
          icon={MicIcon}
          label="음향 상태"
          value={latestEvent?.soundStatus ?? "Normal"}
          accent="green"
        />
      </div>
    </div>
  );
}
