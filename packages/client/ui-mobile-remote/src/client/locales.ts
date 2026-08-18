/** English product copy for the optional mobile-remote settings section. */
const en = {
  nav: 'Phone control',
  intro: 'Pair a phone on the same private network to browse workspaces, read sessions, and send or cancel prompts.',
  security: 'The pairing link expires after five minutes. Only the six read/write session methods used by the mobile page are forwarded.',
  loading: 'Loading phone bridge…',
  unavailable: 'Phone control is unavailable.',
  ready: 'Phone bridge is ready.',
  connected: 'A phone is connected.',
  disconnected: 'No phone is connected.',
  openPairing: 'Open pairing page',
  refresh: 'Refresh link',
  disconnect: 'Disconnect phone',
  starting: 'Refreshing…',
  disconnecting: 'Disconnecting…',
  pairingUrl: 'Pairing link',
  error: 'Phone control failed:',
} as const

/** Chinese product copy for the optional mobile-remote settings section. */
const zh = {
  nav: '手机控制',
  intro: '在同一私有网络中配对手机，即可浏览工作区、查看会话、发送或取消提示。',
  security: '配对链接五分钟后过期，只会转发手机页面使用的六个读写会话方法。',
  loading: '正在加载手机桥接…',
  unavailable: '手机控制不可用。',
  ready: '手机桥接已就绪。',
  connected: '已有手机连接。',
  disconnected: '当前没有手机连接。',
  openPairing: '打开配对页面',
  refresh: '刷新链接',
  disconnect: '断开手机',
  starting: '正在刷新…',
  disconnecting: '正在断开…',
  pairingUrl: '配对链接',
  error: '手机控制失败：',
} as const

/** Keys shared by the English and Chinese dictionaries. */
export type MobileRemoteKey = keyof typeof en
export { en, zh }
