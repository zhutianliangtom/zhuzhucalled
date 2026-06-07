﻿import { storage } from './storage'

const baseUrl = 'https://chentian.dpdns.org'

// 心跳检测配置
let heartbeatTimer = null
let isOnline = true
let heartbeatFailCount = 0 // 连续失败次数
const MAX_FAIL_COUNT = 3 // 最大允许连续失败次数（3次 = 45秒）
let offlineBannerTimer = null // 断网提示定时器
let offlineBannerShown = false // 标记断网提示是否已显示

// 显示断网提示（不显示Toast，只更新状态）
const showOfflineBanner = () => {
  if (offlineBannerShown) {
    return
  }
  
  offlineBannerShown = true
  
  if (offlineBannerTimer) {
    clearTimeout(offlineBannerTimer)
  }
}

// 隐藏断网提示
const hideOfflineBanner = () => {
  // 清除重试定时器
  if (offlineBannerTimer) {
    clearTimeout(offlineBannerTimer)
    offlineBannerTimer = null
  }
  
  // 重置显示标记
  offlineBannerShown = false
  
  try {
    uni.hideToast()
  } catch (e) {}
}

// 显示网络恢复提示
const showOnlineToast = () => {
  try {
    uni.showToast({
      title: '✅ 网络已恢复',
      icon: 'success',
      duration: 2000
    })
  } catch (e) {}
}

export const api = {
  // 启动心跳检测
  startHeartbeat() {
    if (heartbeatTimer) {
      return
    }
    
    // 立即执行一次心跳检测（处理 Promise）
    this.checkHeartbeat().catch(() => {})
    
    // 然后每15秒执行一次（处理 Promise）
    heartbeatTimer = setInterval(async () => {
      try {
        await this.checkHeartbeat()
      } catch (err) {}
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
        hideOfflineBanner()
        showOnlineToast()
        // 通知全局网络恢复（通过事件总线）
        uni.$emit('network-status-change', { isOnline: true })
      }
      heartbeatFailCount = 0
      isOnline = true
    } catch (error) {
      heartbeatFailCount++
      
      // 连续失败超过阈值，显示断网提示
      if (heartbeatFailCount >= MAX_FAIL_COUNT) {
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
            if (header['X-Heartbeat'] === 'true') {
              reject(new Error('心跳检测失败'))
              return
            }
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
      .filter(key => params[key] !== undefined && params[key] !== null)
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
      if (!token) {
        reject(new Error('请先登录'))
        return
      }
      
      uni.uploadFile({
        url: baseUrl + '/upload/image',
        filePath,
        name: 'image',
        header: {
          'Authorization': `Bearer ${token}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(res.data)
              resolve(data)
            } catch (e) {
              reject(new Error('服务器响应格式错误'))
            }
          } else if (res.statusCode === 401) {
            storage.clearUser()
            uni.reLaunch({ url: '/pages/auth/login' })
            reject(new Error('登录已过期，请重新登录'))
          } else {
            try {
              const errData = JSON.parse(res.data)
              reject(new Error(errData.message || '上传失败'))
            } catch (e) {
              reject(new Error(`上传失败 (${res.statusCode})`))
            }
          }
        },
        fail: (err) => {
          reject(new Error(err.errMsg || '网络请求失败'))
        }
      })
    })
  },
  
  // 注册用头像上传（无需登录，调用 /upload/avatar）
  async uploadAvatarImage(filePath) {
    return await new Promise((resolve, reject) => {
      uni.uploadFile({
        url: baseUrl + '/upload/avatar',
        filePath,
        name: 'image',
        success: (res) => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(res.data)
              resolve(data)
            } catch (e) {
              reject(new Error('服务器响应格式错误'))
            }
          } else {
            try {
              const errData = JSON.parse(res.data)
              reject(new Error(errData.message || '上传失败'))
            } catch (e) {
              reject(new Error(`上传失败 (${res.statusCode})`))
            }
          }
        },
        fail: (err) => {
          reject(new Error(err.errMsg || '网络请求失败'))
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
      if (!token) {
        reject(new Error('请先登录'))
        return
      }
      
      uni.showLoading({ title: '上传中...' })
      uni.uploadFile({
        url: baseUrl + '/upload/video',
        filePath,
        name: 'video',
        header: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        formData: {},
        success: (res) => {
          uni.hideLoading()
          if (res.statusCode === 200) {
            try {
              const data = typeof res.data === 'object' ? res.data : JSON.parse(res.data)
              resolve(data)
            } catch (e) {
              reject(new Error('服务器响应格式错误'))
            }
          } else if (res.statusCode === 401) {
            storage.clearUser()
            uni.reLaunch({ url: '/pages/auth/login' })
            reject(new Error('登录已过期，请重新登录'))
          } else {
            try {
              const errData = typeof res.data === 'object' ? res.data : JSON.parse(res.data)
              reject(new Error(errData.message || '视频上传失败'))
            } catch (e) {
              reject(new Error(`视频上传失败 (${res.statusCode})`))
            }
          }
        },
        fail: (err) => {
          uni.hideLoading()
          reject(new Error(err.errMsg || '网络请求失败'))
        }
      })
    })
  },

  // ==================== 版本更新 API ====================
  async getLatestVersion() {
    return await this.request('/version/latest', 'GET')
  },

  async getVersionList() {
    return await this.request('/version/list', 'GET')
  },

  // 获取加密的下载地址
  async getEncryptedDownloadUrl(versionId) {
    return await this.request(`/version/${versionId}/download-url`, 'GET')
  }
}