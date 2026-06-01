import {
  AlertIcon,
  BellIcon,
  HomeIcon,
  ShieldIcon,
  WarningIcon,
  WaveIcon,
} from '../icons'

export const tabs = [
  { id: 'dashboard', label: '대시보드', icon: HomeIcon },
  { id: 'monitor', label: '실시간 모니터링', icon: WaveIcon },
  { id: 'alerts', label: '알림 내역', icon: BellIcon },
]

export const activities = [
  { time: '14:30', status: '정상 상태', type: 'safe' },
  { time: '14:12', status: '정상 상태', type: 'safe' },
  { time: '14:05', status: '위험 감지 (울음 감지)', type: 'danger' },
  { time: '13:50', status: '정상 상태', type: 'safe' },
]

export const alerts = [
  {
    id: 'crying-detected-140512',
    title: '위험 감지 (울음 감지)',
    message: '울음 소리가 감지되었습니다.',
    time: '2026-05-10 14:05:12',
    location: '거실',
    tone: 'danger',
    icon: AlertIcon,
    unread: true,
  },
  {
    id: 'noise-high-123045',
    title: '주의 (소음 높음)',
    message: '주변 소음이 기준값보다 높습니다.',
    time: '2026-05-10 12:30:45',
    location: '거실',
    tone: 'warning',
    icon: WarningIcon,
    unread: false,
  },
  {
    id: 'normal-114522',
    title: '정상 상태',
    message: '현재 감지 상태가 정상입니다.',
    time: '2026-05-10 11:45:22',
    location: '거실',
    tone: 'safe',
    icon: ShieldIcon,
    unread: false,
  },
]
