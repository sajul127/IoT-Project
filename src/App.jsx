import { useEffect, useMemo, useRef, useState } from "react";
import { AlertModal } from "./components/AlertModal";
import { AppHeader } from "./components/AppHeader";
import { BottomNav } from "./components/BottomNav";
import { Alerts } from "./screens/Alerts";
import { Dashboard } from "./screens/Dashboard";
import { Monitor } from "./screens/Monitor";
import {
  acknowledgeAlert,
  buildMonitoringSnapshot,
  changeMonitoringMode,
  createMonitoringSocket,
  getLastUpdate,
  makeActivityItems,
} from "./services/flaskApi";

const MAX_ALERT_HISTORY = 50;

const isBabyMode = (event) =>
  String(event?.mode ?? "").trim().toLowerCase() === "baby";

const getAlertSource = (event) => {
  if (event?.alertSource === "baby_cry") {
    return isBabyMode(event) ? "baby_cry" : null;
  }

  if (event?.alertSource) {
    return event.alertSource;
  }

  if (event?.message?.includes("SOS 버튼")) {
    return "button";
  }

  if (
    isBabyMode(event) &&
    (event?.message?.includes("아기 울음") ||
      event?.message?.includes("baby_cry"))
  ) {
    return "baby_cry";
  }

  return null;
};

const shouldOpenAlertModal = (alert) => {
  const alertSource = getAlertSource(alert?.raw);

  return (
    alert?.raw?.acknowledged === false &&
    alert?.raw?.alertMuted !== true &&
    (alertSource === "button" ||
      (alertSource === "baby_cry" && isBabyMode(alert?.raw)))
  );
};

const requiresServerAcknowledge = (alert) =>
  alert?.raw?.sos && getAlertSource(alert.raw) !== "baby_cry";

const mergeCurrentAlert = (currentAlerts, incomingAlert) => {
  if (!incomingAlert) {
    return currentAlerts;
  }

  const latestAlert = currentAlerts[0];

  if (latestAlert?.signature === incomingAlert.signature) {
    return currentAlerts.map((alert, index) =>
      index === 0
        ? {
            ...incomingAlert,
            id: alert.id,
            time: alert.time,
            unread: incomingAlert.unread && alert.unread,
          }
        : alert,
    );
  }

  return [incomingAlert, ...currentAlerts].slice(0, MAX_ALERT_HISTORY);
};

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [alerts, setAlerts] = useState([]);
  const [activeAlertId, setActiveAlertId] = useState(null);
  const [readAlertIds, setReadAlertIds] = useState(() => new Set());
  const [device, setDevice] = useState(null);
  const [latestEvent, setLatestEvent] = useState(null);
  const socketRef = useRef(null);
  const readAlertIdsRef = useRef(readAlertIds);
  const [connection, setConnection] = useState({
    status: "connecting",
    message: "라즈베리파이 연결 중",
  });
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [isChangingMode, setIsChangingMode] = useState(false);
  const waveform = useMemo(() => {
    const db = Math.abs(latestEvent?.soundLevelDb ?? 0);

    return Array.from({ length: 52 }, () =>
      Math.max(10, Math.min(100, db * 2 + Math.random() * 25)),
    );
  }, [latestEvent]);

  const spectrum = useMemo(() => {
    const status = latestEvent?.soundStatus ?? latestEvent?.status;

    if (status === "Emergency" || status === "danger") {
      return Array.from({ length: 32 }, () => 70 + Math.random() * 30);
    }

    if (status === "Warning" || status === "warning") {
      return Array.from({ length: 32 }, () => 40 + Math.random() * 40);
    }

    return Array.from({ length: 32 }, () => 10 + Math.random() * 25);
  }, [latestEvent]);
  const unreadAlerts = alerts.filter((alert) => alert.unread);
  const activeAlert = alerts.find((alert) => alert.id === activeAlertId);
  const activeAlertRequiresConfirm = requiresServerAcknowledge(activeAlert);
  const activities = useMemo(() => makeActivityItems(alerts), [alerts]);
  const remainingCount = activeAlert
    ? unreadAlerts.filter((alert) => alert.id !== activeAlert.id).length
    : 0;

  useEffect(() => {
    readAlertIdsRef.current = readAlertIds;
  }, [readAlertIds]);

  useEffect(() => {
    const socket = createMonitoringSocket();
    socketRef.current = socket;

    const applyStatus = (status) => {
      const snapshot = buildMonitoringSnapshot(status, readAlertIdsRef.current);

      setAlerts((currentAlerts) =>
        mergeCurrentAlert(currentAlerts, snapshot.currentAlert),
      );
      setDevice(snapshot.device);
      setLatestEvent(snapshot.latestEvent);
      setConnection({
        status: "online",
        message: `실시간 연결됨: ${getLastUpdate(snapshot.device, snapshot.latestEvent)}`,
      });
    };

    socket.on("connect", () => {
      setConnection({
        status: "online",
        message: "라즈베리파이 실시간 연결됨",
      });
    });

    socket.on("status", applyStatus);

    socket.on("connect_error", (error) => {
      setConnection({
        status: "error",
        message: `라즈베리파이 연결 실패: ${error.message}`,
      });
    });

    socket.on("disconnect", () => {
      setConnection({
        status: "connecting",
        message: "라즈베리파이 재연결 중",
      });
    });

    return () => {
      socket.off("status", applyStatus);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (activeAlertId) {
      return;
    }

    const sosAlert = unreadAlerts.find(shouldOpenAlertModal);

    if (sosAlert) {
      setActiveAlertId(sosAlert.id);
    }
  }, [activeAlertId, unreadAlerts]);

  const openLatestAlert = () => {
    if (unreadAlerts.length === 0) {
      setActiveTab("alerts");
      return;
    }

    setActiveAlertId(unreadAlerts[0].id);
  };

  const markAlertAsRead = (alertId) => {
    setReadAlertIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(alertId);
      return nextIds;
    });
    setAlerts((currentAlerts) =>
      currentAlerts.map((alert) =>
        alert.id === alertId ? { ...alert, unread: false } : alert,
      ),
    );
  };

  const markAllAlertsAsRead = () => {
    setReadAlertIds((currentIds) => {
      const nextIds = new Set(currentIds);
      alerts.forEach((alert) => {
        nextIds.add(alert.id);
      });
      return nextIds;
    });
    setAlerts((currentAlerts) =>
      currentAlerts.map((alert) => ({ ...alert, unread: false })),
    );
  };

  const acknowledgeAndClose = async () => {
    if (isAcknowledging) {
      return;
    }

    setIsAcknowledging(true);

    try {
      await acknowledgeAlert(socketRef.current);
      if (activeAlertId) {
        markAlertAsRead(activeAlertId);
      }
      setActiveAlertId(null);
    } catch (error) {
      setConnection({
        status: "error",
        message: error.message,
      });
    } finally {
      setIsAcknowledging(false);
    }
  };

  const closeAlert = () => {
    if (activeAlertId) {
      markAlertAsRead(activeAlertId);
    }

    setActiveAlertId(null);
  };

  const viewAlertDetail = async () => {
    if (isAcknowledging) {
      return;
    }

    setIsAcknowledging(true);

    try {
      if (activeAlertRequiresConfirm) {
        await acknowledgeAlert(socketRef.current);
      }

      markAllAlertsAsRead();
      setActiveAlertId(null);
      setActiveTab("alerts");
    } catch (error) {
      setConnection({
        status: "error",
        message: error.message,
      });
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleModeChange = async (mode) => {
    if (isChangingMode || latestEvent?.mode === mode) {
      return;
    }

    setIsChangingMode(true);

    try {
      await changeMonitoringMode(socketRef.current, mode);
    } catch (error) {
      setConnection({
        status: "error",
        message: error.message,
      });
    } finally {
      setIsChangingMode(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_34%),linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] p-7 max-[520px]:bg-white max-[520px]:p-0">
      <section
        className="relative flex h-[min(844px,calc(100vh-56px))] min-h-[720px] w-[min(100%,390px)] flex-col overflow-hidden rounded-[22px] border border-[#cfd8e6] bg-white shadow-[0_24px_70px_rgba(26,47,79,0.18)] max-[520px]:h-screen max-[520px]:min-h-screen max-[520px]:w-full max-[520px]:rounded-none max-[520px]:border-0 max-[520px]:shadow-none"
        aria-label="음향 분석 기반 안심 모니터링 시스템"
      >
        <AppHeader
          activeTab={activeTab}
          unreadCount={unreadAlerts.length}
          onAlertClick={openLatestAlert}
        />

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-[180px] pt-1.5">
          {activeTab === "dashboard" && (
            <Dashboard
              activities={activities}
              connection={connection}
              device={device}
              latestEvent={latestEvent}
              onDetailClick={() => setActiveTab("monitor")}
              onViewAllActivities={() => setActiveTab("alerts")}
            />
          )}
          {activeTab === "monitor" && (
            <Monitor
              connection={connection}
              latestEvent={latestEvent}
              onModeChange={handleModeChange}
              isChangingMode={isChangingMode}
              spectrum={spectrum}
              waveform={waveform}
            />
          )}
          {activeTab === "alerts" && (
            <Alerts alerts={alerts} onAlertClick={setActiveAlertId} />
          )}
        </div>

        <BottomNav activeTab={activeTab} onChange={setActiveTab} />

        {activeAlert && (
          <AlertModal
            alert={activeAlert}
            remainingCount={remainingCount}
            onClose={closeAlert}
            onViewDetail={viewAlertDetail}
            onConfirm={acknowledgeAndClose}
            requiresConfirm={activeAlertRequiresConfirm}
            isConfirming={isAcknowledging}
          />
        )}
      </section>
    </main>
  );
}

export default App;
