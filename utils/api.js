import { storage } from './storage'

const baseUrl = 'http://183.66.27.20:41412'

// 心跳检测配置
let heartbeatTimer = null
let isOnline = true
let heartbeatFailCount = 0 // 连续失败次数
const MAX_FAIL_COUNT = 3 // 最大允许连续失败次数（3次 = 45秒）
let offlineBannerTimer = null // 断网提示定时器

// 显示断网提示（持久化的顶部提示条）
const showOfflineBanner = () => {
  console.log('🔴 显示断网提示')
  
  // 清除之前的定时器
  if (offlineBannerTimer) {
    clearTimeout(offlineBannerTimer)
  }
  
  // 使用uni.showToast显示持久提示
  try {
    uni.showToast({
      title: '⚠️ 无法连接服务器',
      icon: 'none',
      duration: 999999, // 持久显示
      mask: false
    })
    console.log('✅ Toast已调用')
  } catch (e) {
    console.error('显示Toast失败:', e)
  }
  
  // 如果Toast没有显示，每5秒重试一次
  offlineBannerTimer = setTimeout(() => {
    showOfflineBanner()
  }, 5000)
}

// 隐藏断网提示
const hideOfflineBanner = () => {
  console.log('🟢 隐藏断网提示')
  
  // 清除重试定时器
  if (offlineBannerTimer) {
    clearTimeout(offlineBannerTimer)
    offlineBannerTimer = null
  }
  
  try {
    uni.hideToast()
    console.log('✅ Toast已隐藏')
  } catch (e) {
    console.error('隐藏Toast失败:', e)
  }
}

// 显示网络恢复提示
const showOnlineToast = () => {
  try {
    uni.showToast({
      title: '✅ 网络已恢复',
      icon: 'success',
      duration: 2000
    })
    console.log('✅ 网络恢复提示已显示')
  } catch (e) {
    console.error('显示恢复提示失败:', e)
  }
}

export const api = {
  // 启动心跳检测
  startHeartbeat() {
    if (heartbeatTimer) {
      console.log('心跳检测已在运行')
      return
    }
    
    console.log('启动15秒心跳检测...')
    
    // 立即执行一次心跳检测
    this.checkHeartbeat()
    
    // 然后每15秒执行一次
    heartbeatTimer = setInterval(() => {
      this.checkHeartbeat()
    }, 15000) // 15秒间隔
  },
  
  // 执行单次心跳检测
  async checkHeartbeat() {
    // 始终执行心跳检测，不管是否登录
    try {
      await this.request('/api/heartbeat', 'GET', {}, {
        'X-Heartbeat': 'true' // 标记为心跳请求
      })
      
      // 心跳成功，如果之前是断网状态则隐藏断网提示并显示恢复提示
      if (!isOnline) {
        console.log('✅ 网络已恢复')
        hideOfflineBanner()
        showOnlineToast()
        // 通知全局网络恢复（通过事件总线）
        uni.$emit('network-status-change', { isOnline: true })
      }
      heartbeatFailCount = 0
      isOnline = true
    } catch (error) {
      heartbeatFailCount++
      const errorMsg = error.errMsg || error.message || 'Unknown error'
      console.warn(`心跳检测失败 (${heartbeatFailCount}/${MAX_FAIL_COUNT})`, errorMsg)
      
      // 连续失败超过阈值，显示断网提示
      if (heartbeatFailCount >= MAX_FAIL_COUNT) {
        console.error('连续心跳失败，显示断网提示')
        isOnline = false
        showOfflineBanner()
        // 通知全局断网（通过事件总线）
        uni.$emit('network-status-change', { isOnline: false })
      }
    }
  },
  
  // 停止心跳检测
  stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
      console.log('心跳检测已停止')
    }
  },
  
  // 获取在线状态
  getOnlineStatus() {
    return isOnline
  },
  
  // 重置心跳状态（用户登录时调用）
  resetHeartbeat() {
    heartbeatFailCount = 0
    isOnline = true
    this.stopHeartbeat()
    this.startHeartbeat()
  },
  async request(url, method = 'GET', data = {}, header = {}) {
    // 检查是否已有token
    const token = storage.getToken()
    
    const defaultHeader = {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
    
    return new Promise((resolve, reject) => {
      uni.request({
        url: baseUrl + url,
        method,
        data,
        header: { ...defaultHeader, ...header },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data)
          } else if (res.statusCode === 401) {
            // 如果是心跳请求401，不跳转登录页
            if (header['X-Heartbeat'] === 'true') {
              reject(new Error('心跳检测失败'))
              return
            }
            // 其他请求401，跳转登录
            storage.clearUser()
            uni.reLaunch({ url: '/pages/auth/login' })
            reject(new Error('登录已过期'))
          } else {
            reject(new Error(res.data.message || '请求失败'))
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  },
  
  async register(data) {
    return await this.request('/auth/register', 'POST', data)
  },
  
  async login(data) {
    return await this.request('/auth/login', 'POST', data)
  },
  
  async getUserInfo() {
    return await this.request('/user/info')
  },
  
  async updateUserInfo(data) {
    return await this.request('/user/info', 'PUT', data)
  },
  
  async searchUsers(keyword) {
    return await this.request(`/user/search?keyword=${encodeURIComponent(keyword)}`)
  },
  
  async getItems(params = {}) {
    const query = Object.keys(params)
      .filter(key => params[key])
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&')
    
    return await this.request(`/items${query ? '?' + query : ''}`)
  },
  
  async getItem(id) {
    return await this.request(`/items/${id}`)
  },
  
  async createItem(data) {
    return await this.request('/items', 'POST', data)
  },
  
  async updateItem(id, data) {
    return await this.request(`/items/${id}`, 'PUT', data)
  },
  
  async deleteItem(id) {
    return await this.request(`/items/${id}`, 'DELETE')
  },
  
  async solveItem(id) {
    return await this.request(`/items/${id}/solve`, 'POST')
  },
  
  async getUserStats() {
    return await this.request('/user/stats')
  },
  
  async getStats() {
    return await this.request('/stats')
  },
  
  async getUserItems(params = {}) {
    const query = Object.keys(params)
      .filter(key => params[key])
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&')
    
    return await this.request(`/user/items${query ? '?' + query : ''}`)
  },
  
  async getMessages() {
    return await this.request('/messages')
  },

  async getUnreadCount() {
    return await this.request('/messages/unread/count')
  },
  
  async getConversation(userId) {
    return await this.request(`/messages/conversation/${userId}`)
  },
  
  // 标记对话已读（清除未读数）
  async markConversationRead(userId) {
    return await this.request(`/messages/conversation/${userId}/read`, 'POST')
  },
  
  async sendMessage(userId, content, type = 'text', mediaUrl = '') {
    return await this.request('/messages/send', 'POST', { userId, content, type, mediaUrl })
  },
  
  async blockUser(userId) {
    return await this.request('/user/block', 'POST', { userId })
  },
  
  async unblockUser(userId) {
    return await this.request('/user/unblock', 'POST', { userId })
  },
  
  async getBlockedUsers() {
    return await this.request('/user/blocked')
  },
  
  async uploadImage(filePath) {
    return await new Promise((resolve, reject) => {
      const token = storage.getToken()
      uni.uploadFile({
        url: baseUrl + '/upload/image',
        filePath,
        name: 'image',
        header: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(res.data))
          } else {
            reject(new Error('上传失败'))
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  },
  
  async uploadImages(filePaths) {
    const results = []
    for (let filePath of filePaths) {
      const result = await this.uploadImage(filePath)
      results.push(result.url)
    }
    return { urls: results }
  },
  
  async recallMessage(messageId) {
    return await this.request(`/messages/${messageId}/recall`, 'POST')
  },

  async uploadVideo(filePath) {
    return await new Promise((resolve, reject) => {
      const token = storage.getToken()
      uni.showLoading({ title: '上传中...' })
      uni.uploadFile({
        url: baseUrl + '/upload/video',
        filePath,
        name: 'video',
        header: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        success: (res) => {
          uni.hideLoading()
          if (res.statusCode === 200) {
            resolve(JSON.parse(res.data))
          } else {
            reject(new Error('视频上传失败'))
          }
        },
        fail: (err) => {
          uni.hideLoading()
          reject(err)
        }
      })
    })
  }
}