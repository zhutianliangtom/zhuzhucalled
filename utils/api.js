import { storage } from './storage'

const baseUrl = 'https://chentian.dpdns.org'

let heartbeatTimer = null
let isOnline = true
let heartbeatFailCount = 0
const MAX_FAIL_COUNT = 5
let offlineBannerTimer = null
let offlineBannerShown = false

const showOfflineBanner = () => {
  if (offlineBannerShown) {
    return
  }
  offlineBannerShown = true
  if (offlineBannerTimer) {
    clearTimeout(offlineBannerTimer)
  }
  // 触发事件让OfflineBanner显示
  uni.$emit('network-status-change', { isOnline: false })
}

const hideOfflineBanner = () => {
  if (!offlineBannerShown) {
    return
  }
  if (offlineBannerTimer) {
    clearTimeout(offlineBannerTimer)
    offlineBannerTimer = null
  }
  offlineBannerShown = false
  try {
    uni.hideToast()
  } catch (e) {}
  // 触发事件让OfflineBanner隐藏
  uni.$emit('network-status-change', { isOnline: true })
}

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
  startHeartbeat() {
    if (heartbeatTimer) {
      return
    }
    // 首次心跳延迟3秒，确保页面已加载
    setTimeout(() => {
      this.checkHeartbeat().catch(() => {})
    }, 3000)
    heartbeatTimer = setInterval(async () => {
      try {
        await this.checkHeartbeat()
      } catch (err) {}
    }, 15000)
  },
  async checkHeartbeat() {
    try {
      await this.request('/api/heartbeat', 'GET', {}, {
        'X-Heartbeat': 'true'
      })
      // 心跳成功，隐藏横幅并触发事件
      if (offlineBannerShown) {
        hideOfflineBanner()
        showOnlineToast()
      }
      heartbeatFailCount = 0
      isOnline = true
      // 触发网络状态事件（确保OfflineBanner能隐藏）
      uni.$emit('network-status-change', { isOnline: true })
    } catch (error) {
      // 如果错误信息包含"其他设备"，说明被顶号了（已经在request中调用了handleForceLogout）
      if (error.message && error.message.includes('其他设备')) {
        return
      }
      
      heartbeatFailCount++
      if (heartbeatFailCount >= MAX_FAIL_COUNT) {
        isOnline = false
        showOfflineBanner()
        uni.$emit('network-status-change', { isOnline: false })
      }
    }
  },
  stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  },
  getOnlineStatus() {
    return isOnline
  },
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
      'Authorization': token ? 'Bearer ' + token : ''
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
            const message = res.data.message || '未登录或登录已过期'
            // 检测是否被顶号
            if (message.includes('其他设备登录') || message.includes('其他设备')) {
              this.handleForceLogout()
              reject(new Error(message))
              return
            }
            if (header['X-Heartbeat'] === 'true') {
              reject(new Error('心跳检测失败'))
              return
            }
            reject(new Error(message))
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
  handleForceLogout() {
    storage.clearUser()
    this.stopHeartbeat()
    uni.showToast({
      title: '您的账号已在其他设备登录',
      icon: 'none',
      duration: 3000
    })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/auth/login' })
    }, 1500)
  },
  async register(data) {
    return await this.request('/auth/register', 'POST', data)
  },
  async login(data) {
    return await this.request('/auth/login', 'POST', data)
  },
  async forceLogin(data) {
    return await this.request('/auth/login/force', 'POST', data)
  },
  async logout() {
    return await this.request('/auth/logout', 'POST')
  },
  async getUserInfo() {
    return await this.request('/user/info')
  },
  async updateUserInfo(data) {
    return await this.request('/user/info', 'PUT', data)
  },
  async searchUsers(keyword) {
    return await this.request('/user/search?keyword=' + encodeURIComponent(keyword))
  },
  async getItems(params = {}) {
    const query = Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
      .join('&')
    return await this.request('/items' + (query ? '?' + query : ''))
  },
  async getItem(id) {
    return await this.request('/items/' + id)
  },
  async createItem(data) {
    return await this.request('/items', 'POST', data)
  },
  async updateItem(id, data) {
    return await this.request('/items/' + id, 'PUT', data)
  },
  async deleteItem(id) {
    return await this.request('/items/' + id, 'DELETE')
  },
  async solveItem(id) {
    return await this.request('/items/' + id + '/solve', 'POST')
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
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
      .join('&')
    return await this.request('/user/items' + (query ? '?' + query : ''))
  },
  async getMessages() {
    return await this.request('/messages')
  },
  async getUnreadCount() {
    return await this.request('/messages/unread/count')
  },
  async getConversation(userId) {
    return await this.request('/messages/conversation/' + userId)
  },
  async markConversationRead(userId) {
    return await this.request('/messages/conversation/' + userId + '/read', 'POST')
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
          'Authorization': 'Bearer ' + token
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
            reject(new Error('未登录或登录已过期'))
          } else {
            try {
              const errData = JSON.parse(res.data)
              reject(new Error(errData.message || '上传失败'))
            } catch (e) {
              reject(new Error('上传失败 (' + res.statusCode + ')'))
            }
          }
        },
        fail: (err) => {
          reject(new Error(err.errMsg || '网络请求失败'))
        }
      })
    })
  },
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
              reject(new Error('上传失败 (' + res.statusCode + ')'))
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
    return await this.request('/messages/' + messageId + '/recall', 'POST')
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
          'Authorization': 'Bearer ' + token,
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
            reject(new Error('未登录或登录已过期'))
          } else {
            try {
              const errData = typeof res.data === 'object' ? res.data : JSON.parse(res.data)
              reject(new Error(errData.message || '视频上传失败'))
            } catch (e) {
              reject(new Error('视频上传失败 (' + res.statusCode + ')'))
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
  async getLatestVersion() {
    return await this.request('/version/latest', 'GET')
  },
  async getVersionList() {
    return await this.request('/version/list', 'GET')
  },
  async getEncryptedDownloadUrl(versionId) {
    return await this.request('/version/' + versionId + '/download-url', 'GET')
  },
  async getTodayLuck() {
    return await this.request('/luck/today', 'GET')
  },
  async getTodayLuckUser() {
    return await this.request('/luck/today/user', 'GET')
  }
}
