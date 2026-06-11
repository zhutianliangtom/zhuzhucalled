import { storage } from './storage'

let reconnectTimer = null
let heartbeatTimer = null
let maxReconnectAttempts = 999
let reconnectAttempts = 0
let reconnectDelay = 3000
let shouldReconnect = true
let isConnected = false
let socketCreated = false

const WS_URL = 'wss://chentian.dpdns.org/ws'
const HEARTBEAT_INTERVAL = 30000
const listeners = []

// 全局消息队列：在 connectSocket 之前就注册好 onSocketMessage
// uni-app 的 onSocketOpen/onSocketMessage/onSocketError/onSocketClose 是全局单例
// 必须在任意 connectSocket 调用前注册，否则会丢消息
function registerGlobalSocketListeners() {
  if (socketCreated) return
  socketCreated = true

  uni.onSocketOpen(function(res) {
    console.log('[WebSocket] 连接成功')
    isConnected = true
    reconnectAttempts = 0
    websocket.stopHeartbeat()
    websocket.startHeartbeat()
    websocket.notifyListeners('connected', null)
  })

  uni.onSocketMessage(function(event) {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      console.log('[WebSocket] 收到消息:', JSON.stringify(data))
      websocket.notifyListeners('message', data)
    } catch (e) {
      console.error('[WebSocket] 消息解析失败', e)
    }
  })

  uni.onSocketError(function(res) {
    console.error('[WebSocket] 错误:', res)
    isConnected = false
    websocket.stopHeartbeat()
    websocket.notifyListeners('error', res)
  })

  uni.onSocketClose(function(res) {
    console.log('[WebSocket] 连接关闭, code:', res.code)
    isConnected = false
    websocket.stopHeartbeat()
    
    // 检测是否被强制下线（code 1008 = 账号在其他设备登录）
    if (res.code === 1008) {
      console.log('[WebSocket] 检测到强制下线')
      shouldReconnect = false
      // 触发全局事件，让App.vue处理强制登出
      uni.$emit('force-logout', { code: res.code, reason: res.reason })
      return
    }
    
    websocket.notifyListeners('disconnected', res)
    if (shouldReconnect) {
      websocket.scheduleReconnect()
    }
  })
}

export const websocket = {
  connect() {
    console.log('[WebSocket] connect() 被调用, 当前状态 isConnected=' + isConnected)

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

    // 先注册全局监听器（必须在 connectSocket 之前）
    registerGlobalSocketListeners()

    const url = `${WS_URL}?token=${token}`
    console.log('[WebSocket] 连接地址:', url.replace(token, '***'))

    try {
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
              console.error('[WebSocket] 心跳发送失败', err)
              isConnected = false
              this.stopHeartbeat()
              this.scheduleReconnect()
            }
          })
        } catch (e) {
          console.error('[WebSocket] 心跳发送异常', e)
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
    const delay = Math.min(reconnectDelay * reconnectAttempts, 60000)
    console.log([WebSocket] ms 后尝试重连 (第 次))

    reconnectTimer = setTimeout(() => {
      shouldReconnect = true
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

  isConnected() {
    return isConnected
  }
}
