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
import "./App.css";

const MAX_ALERT_HISTORY = 50;

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
            unread: alert.unread,
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

    const sosAlert = unreadAlerts.find((alert) => alert.raw?.sos);

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
      if (activeAlert?.raw?.sos) {
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
    <main className="app-shell">
      <section
        className="phone-frame"
        aria-label="음향 분석 기반 안심 모니터링 시스템"
      >
        <AppHeader
          activeTab={activeTab}
          unreadCount={unreadAlerts.length}
          onAlertClick={openLatestAlert}
        />

        <div className="screen-body">
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
            isConfirming={isAcknowledging}
          />
        )}
      </section>
    </main>
  );
}

export default App;
