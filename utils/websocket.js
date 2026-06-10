import { storage } from './storage'

let ws = null
let reconnectTimer = null
let maxReconnectAttempts = 5
let reconnectAttempts = 0
let reconnectDelay = 5000

const WS_URL = 'wss://chentian.dpdns.org/ws'

const listeners = []

export const websocket = {
  connect() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      return
    }

    const token = storage.getToken()
    if (!token) {
      console.warn('WebSocket: 未登录，延迟连接')
      setTimeout(() => this.connect(), 3000)
      return
    }

    const url = `${WS_URL}?token=${token}`
    
    try {
      ws = new WebSocket(url)

      ws.onopen = () => {
        console.log('WebSocket: 连接成功')
        reconnectAttempts = 0
        this.notifyListeners('connected', null)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('WebSocket: 收到消息', data)
          this.notifyListeners('message', data)
        } catch (e) {
          console.error('WebSocket: 消息解析失败', e)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket: 错误', error)
        this.notifyListeners('error', error)
        this.scheduleReconnect()
      }

      ws.onclose = (event) => {
        console.log('WebSocket: 连接关闭', event.code, event.reason)
        this.notifyListeners('disconnected', event)
        this.scheduleReconnect()
      }
    } catch (e) {
      console.error('WebSocket: 连接创建失败', e)
      this.scheduleReconnect()
    }
  },

  disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    
    if (ws) {
      ws.close(1000, '主动断开')
      ws = null
    }
    reconnectAttempts = 0
  },

  scheduleReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    if (reconnectAttempts >= maxReconnectAttempts) {
      console.warn('WebSocket: 已达到最大重试次数')
      return
    }

    reconnectAttempts++
    const delay = reconnectDelay * reconnectAttempts
    console.log(`WebSocket: ${delay}ms 后尝试重连 (第 ${reconnectAttempts} 次)`)
    
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
        console.error('WebSocket: 监听器回调失败', e)
      }
    })
  },

  send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data)
        ws.send(message)
        return true
      } catch (e) {
        console.error('WebSocket: 发送失败', e)
        return false
      }
    }
    return false
  },

  getReadyState() {
    return ws ? ws.readyState : WebSocket.CLOSED
  },

  isConnected() {
    return ws && ws.readyState === WebSocket.OPEN
  }
}