import { storage } from './storage'

let reconnectTimer = null
let heartbeatTimer = null
let maxReconnectAttempts = 999  // 几乎无限重连
let reconnectAttempts = 0
let reconnectDelay = 3000
let shouldReconnect = true
let isConnected = false
let hasRegisteredListeners = false

const WS_URL = 'wss://chentian.dpdns.org/ws'
const HEARTBEAT_INTERVAL = 30000  // 30秒心跳

const listeners = []

export const websocket = {
  connect() {
    console.log('[WebSocket] connect() 被调用, 当前状态: isConnected=' + isConnected)
    
    if (isConnected) {
      console.log('[WebSocket] 已连接，跳过')
      return
    }

    const token = storage.getToken()
    console.log('[WebSocket] 获取到的 token:', token ? '存在' : '不存在')
    
    if (!token) {
      console.warn('[WebSocket] 未登录，延迟连接')
      setTimeout(() => this.connect(), 3000)
      return
    }

    const url = `${WS_URL}?token=${token}`
    console.log('[WebSocket] 连接地址:', url.replace(token, '***'))
    
    try {
      // 只注册一次全局监听
      if (!hasRegisteredListeners) {
        hasRegisteredListeners = true
        console.log('[WebSocket] 注册全局监听器')
        uni.onSocketOpen(this.onOpen)
        uni.onSocketMessage(this.onMessage)
        uni.onSocketError(this.onError)
        uni.onSocketClose(this.onClose)
      }
      
      // 建立 WebSocket 连接
      console.log('[WebSocket] 调用 uni.connectSocket')
      uni.connectSocket({
        url: url,
        success: () => {
          console.log('[WebSocket] 连接请求已发送')
        },
        fail: (error) => {
          console.error('[WebSocket] 连接请求失败', error)
          setTimeout(() => this.scheduleReconnect(), 1000)
        }
      })
      
    } catch (e) {
      console.error('[WebSocket] 连接创建失败', e)
      this.scheduleReconnect()
    }
  },

  onOpen: function() {
    console.log('[WebSocket] 连接成功')
    isConnected = true
    reconnectAttempts = 0
    websocket.notifyListeners('connected', null)
    
    // 启动心跳
    websocket.startHeartbeat()
  },

  onMessage: function(event) {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      console.log('[WebSocket] 收到消息:', JSON.stringify(data))
      websocket.notifyListeners('message', data)
    } catch (e) {
      console.error('[WebSocket] 消息解析失败', e)
    }
  },

  onError: function(error) {
    console.error('[WebSocket] 错误:', error)
    isConnected = false
    websocket.stopHeartbeat()
    websocket.notifyListeners('error', error)
    setTimeout(() => websocket.scheduleReconnect(), 1000)
  },

  onClose: function(event) {
    console.log('[WebSocket] 连接关闭, code:', event.code, 'reason:', event.reason)
    isConnected = false
    websocket.stopHeartbeat()
    websocket.notifyListeners('disconnected', event)
    if (shouldReconnect) {
      websocket.scheduleReconnect()
    }
  },

  // 启动心跳保活
  startHeartbeat() {
    this.stopHeartbeat()
    
    heartbeatTimer = setInterval(() => {
      if (isConnected) {
        console.log('[WebSocket] 发送心跳...')
        try {
          uni.sendSocketMessage({
            data: JSON.stringify({ type: 'ping' }),
            success: () => {
              console.log('[WebSocket] 心跳发送成功')
            },
            fail: (err) => {
              console.error('[WebSocket] 心跳发送失败:', err)
              // 心跳失败，可能连接已断开，触发重连
              isConnected = false
              this.stopHeartbeat()
              this.scheduleReconnect()
            }
          })
        } catch (e) {
          console.error('[WebSocket] 心跳发送异常:', e)
        }
      }
    }, HEARTBEAT_INTERVAL)
    
    console.log('[WebSocket] 心跳已启动，间隔:', HEARTBEAT_INTERVAL, 'ms')
  },

  // 停止心跳
  stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
      console.log('[WebSocket] 心跳已停止')
    }
  },

  disconnect() {
    console.log('[WebSocket] 主动断开连接')
    shouldReconnect = false
    this.stopHeartbeat()
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    
    try {
      uni.closeSocket({
        success: () => {
          console.log('[WebSocket] 主动断开成功')
        },
        fail: () => {
          console.log('[WebSocket] 主动断开失败')
        }
      })
    } catch (e) {
      console.error('[WebSocket] 断开连接失败', e)
    }
    
    isConnected = false
    reconnectAttempts = 0
  },

  scheduleReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    if (reconnectAttempts >= maxReconnectAttempts) {
      console.warn('[WebSocket] 已达到最大重试次数')
      return
    }

    reconnectAttempts++
    const delay = Math.min(reconnectDelay * reconnectAttempts, 60000)  // 最多延迟60秒
    console.log(`[WebSocket] ${delay}ms 后尝试重连 (第 ${reconnectAttempts} 次)`)
    
    reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  },

  addListener(callback) {
    if (!listeners.includes(callback)) {
      listeners.push(callback)
    }
    return () => {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  },

  notifyListeners(event, data) {
    listeners.forEach(callback => {
      try {
        callback(event, data)
      } catch (e) {
        console.error('[WebSocket] 监听器回调失败', e)
      }
    })
  },

  send(data) {
    return new Promise((resolve, reject) => {
      if (!isConnected) {
        reject(new Error('WebSocket 未连接'))
        return
      }
      
      const message = typeof data === 'string' ? data : JSON.stringify(data)
      uni.sendSocketMessage({
        data: message,
        success: () => resolve(true),
        fail: (error) => {
          console.error('[WebSocket] 发送失败', error)
          reject(error)
        }
      })
    })
  },

  getReadyState() {
    return isConnected ? 1 : 3
  },

  isConnected() {
    return isConnected
  }
}