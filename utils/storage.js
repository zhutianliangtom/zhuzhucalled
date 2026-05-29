const USER_KEY = 'lost_and_found_user'
const TOKEN_KEY = 'lost_and_found_token'
const SETTINGS_KEY = 'lost_and_found_settings'

export const storage = {
  setUser(user) {
    uni.setStorageSync(USER_KEY, JSON.stringify(user))
  },
  getUser() {
    try {
      const data = uni.getStorageSync(USER_KEY)
      return data ? JSON.parse(data) : null
    } catch (e) {
      return null
    }
  },
  setToken(token) {
    uni.setStorageSync(TOKEN_KEY, token)
  },
  getToken() {
    try {
      const token = uni.getStorageSync(TOKEN_KEY)
      return token || ''
    } catch (e) {
      return ''
    }
  },
  clearUser() {
    uni.removeStorageSync(USER_KEY)
    uni.removeStorageSync(TOKEN_KEY)
    // 注意：不再自动停止心跳，让心跳继续检测网络状态
  },
  setSettings(settings) {
    uni.setStorageSync(SETTINGS_KEY, JSON.stringify(settings))
  },
  getSettings() {
    try {
      const data = uni.getStorageSync(SETTINGS_KEY)
      return data ? JSON.parse(data) : null
    } catch (e) {
      return null
    }
  }
}