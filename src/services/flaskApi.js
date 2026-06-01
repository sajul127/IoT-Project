import { AlertIcon, ShieldIcon, WarningIcon } from '../icons'
import { io } from 'socket.io-client'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://165.229.125.127:5000'

const iconByTone = {
  danger: AlertIcon,
  warning: WarningIcon,
  safe: ShieldIcon,
}

const formatDateTime = (value) => {
  if (!value) {
    return '수신 대기 중'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const normalizeStatus = (status) => String(status ?? '').trim().toLowerCase()

const getTone = (status) => {
  if (status?.sos || normalizeStatus(status?.status) === 'sos') {
    return 'danger'
  }

  const normalizedStatus = normalizeStatus(status?.status)

  if (normalizedStatus === 'danger' || normalizedStatus === 'emergency') {
    return 'danger'
  }

  if (normalizedStatus === 'warning' || normalizedStatus === 'error') {
    return 'warning'
  }

  return 'safe'
}

const getStatusText = (status) => {
  const normalizedStatus = normalizeStatus(status?.status)

  if (status?.sos || normalizedStatus === 'sos') {
    return {
      title: 'SOS 알림',
      message: status?.message ?? '보호자 호출 신호가 감지되었습니다.',
    }
  }

  if (normalizedStatus === 'danger' || normalizedStatus === 'emergency') {
    return {
      title: '위험 감지',
      message: status?.message ?? '위험 상황이 감지되었습니다.',
    }
  }

  if (normalizedStatus === 'warning' || normalizedStatus === 'error') {
    return {
      title: '주의 필요',
      message: status?.message ?? '주의가 필요한 상태입니다.',
    }
  }

  return {
    title: '정상 상태',
    message: status?.message ?? '현재 감지 상태가 정상입니다.',
  }
}

const getStatusSignature = (status) => {
  if (status?.sos || normalizeStatus(status?.status) === 'sos') {
    return 'danger:sos'
  }

  return `${getTone(status)}:${normalizeStatus(status?.status) || 'unknown'}`
}

const buildStatusAlert = (status, readAlertIds) => {
  const tone = getTone(status)
  const text = getStatusText(status)
  const detectedAt = status.updatedAt ?? status.timestamp ?? new Date().toISOString()
  const signature = getStatusSignature(status)
  const id = `${signature}:${detectedAt}`

  return {
    id,
    signature,
    ...text,
    time: formatDateTime(detectedAt),
    location: status.location ?? '거실',
    tone,
    icon: iconByTone[tone],
    unread: tone !== 'safe' && !readAlertIds.has(id),
    raw: status,
  }
}

const fetchJson = async (path) => {
  const response = await fetch(`${API_BASE_URL}${path}`)

  if (!response.ok) {
    throw new Error(`라즈베리파이 API 요청 실패 (${response.status})`)
  }

  return response.json()
}

export async function fetchMonitoringSnapshot(readAlertIds = new Set()) {
  const status = await fetchJson('/api/status')
  return buildMonitoringSnapshot(status, readAlertIds)
}

export function buildMonitoringSnapshot(status, readAlertIds = new Set()) {
  const alert = buildStatusAlert(status, readAlertIds)
  return {
    currentAlert: alert,
    device: status,
    latestEvent: status,
    updatedAt: new Date().toISOString(),
  }
}

export function createMonitoringSocket() {
  return io(API_BASE_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 5000,
  })
}

export async function acknowledgeAlert(socket) {
  if (socket?.connected) {
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        socket.off('acknowledged', handleAcknowledged)
        reject(new Error('알림 확인 응답 시간이 초과되었습니다.'))
      }, 5000)

      const handleAcknowledged = (response) => {
        window.clearTimeout(timeoutId)
        resolve(response)
      }

      socket.once('acknowledged', handleAcknowledged)
      socket.emit('acknowledge')
    })
  }

  const response = await fetch(`${API_BASE_URL}/api/acknowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`알림 확인 요청 실패 (${response.status})`)
  }

  return response.json()
}

export function changeMonitoringMode(socket, mode) {
  if (!socket?.connected) {
    return Promise.reject(new Error('라즈베리파이 실시간 연결 후 모드를 변경할 수 있습니다.'))
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      socket.off('mode_changed', handleModeChanged)
      reject(new Error('모드 변경 응답 시간이 초과되었습니다.'))
    }, 5000)

    const handleModeChanged = (response) => {
      window.clearTimeout(timeoutId)

      if (response?.success) {
        resolve(response)
        return
      }

      reject(new Error(response?.message ?? '모드 변경에 실패했습니다.'))
    }

    socket.once('mode_changed', handleModeChanged)
    socket.emit('change_mode', { mode })
  })
}

export function makeActivityItems(alerts) {
  return alerts.slice(0, 5).map((alert) => ({
    time: alert.time,
    status: alert.title,
    type: alert.tone === 'safe' ? 'safe' : 'danger',
  }))
}

export function getStatusLabel(status) {
  if (!status) {
    return '대기 중'
  }

  const normalizedStatus = normalizeStatus(status.status)

  if (status.sos || normalizedStatus === 'sos') {
    return 'SOS 알림'
  }

  if (normalizedStatus === 'danger' || normalizedStatus === 'emergency') {
    return '위험 감지'
  }

  if (normalizedStatus === 'warning' || normalizedStatus === 'error') {
    return '주의 필요'
  }

  return '정상 상태'
}

export function getModeLabel(status) {
  if (!status) {
    return '대기 중'
  }

  const normalizedMode = normalizeStatus(status.mode)
  if (normalizedMode === 'baby') {
    return '아기 모드'
  }

  if (normalizedMode === 'elderly') {
    return '독거노인 모드'
  }

  if (normalizedMode === 'active') {
    return 'Active 모드'
  }

  if (normalizedMode === 'standby') {
    return 'Standby 모드'
  }

  return status.mode ?? '대기 중'
}

export function getSoundLevel(status) {
  const soundLevel = status?.soundLevel ?? status?.sound_level
  return Number.isFinite(Number(soundLevel)) ? `${soundLevel} dB` : '수신 대기'
}

export function getDistance(status) {
  const distance = status?.distance
  return Number.isFinite(Number(distance)) ? `${distance} cm` : '수신 대기'
}

export function getLastUpdate(device, event) {
  return formatDateTime(device?.updatedAt ?? device?.timestamp ?? event?.updatedAt ?? event?.timestamp)
}
