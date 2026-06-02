<template>
  <view class="container">
    <view class="user-header" :style="{ paddingTop: (statusBarHeight + 10) + 'px' }">
      <view class="avatar-wrapper" @click="chooseAvatar">
        <image v-if="user?.avatar" :src="getFullImageUrl(user.avatar)" class="avatar" />
        <view v-else class="avatar">
          <text class="avatar-text">{{ user?.name?.charAt(0) || '?' }}</text>
        </view>
        <view class="avatar-edit">
          <text class="edit-icon">📷</text>
        </view>
      </view>
      <view class="user-info">
        <text class="user-name">{{ user?.name || '点击登录' }}</text>
        <text class="user-class">{{ user?.className || user?.studentId }}</text>
      </view>
      <view v-if="user" class="edit-btn" @click="goEdit">
        <text>编辑</text>
      </view>
      <view v-else class="login-btn" @click="goLogin">
        <text>登录</text>
      </view>
    </view>
    
    <view v-if="user" class="stats-section">
      <view class="stat-item">
        <text class="stat-num">{{ stats.lostCount }}</text>
        <text class="stat-label">寻物启事</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-num">{{ stats.foundCount }}</text>
        <text class="stat-label">失物招领</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-num">{{ stats.solvedCount }}</text>
        <text class="stat-label">已解决</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-num">{{ stats.totalCount }}</text>
        <text class="stat-label">总发布</text>
      </view>
    </view>
    
    <view v-if="user" class="menu-list">
      <view class="menu-item" @click="goMyItems('all')">
        <text class="menu-icon">📦</text>
        <text class="menu-text">我的发布</text>
        <text class="menu-count">{{ stats.totalCount }}</text>
        <text class="menu-arrow">›</text>
      </view>
      
      <view class="menu-item" @click="goMyItems('lost')">
        <text class="menu-icon">🔍</text>
        <text class="menu-text">寻物启事</text>
        <text class="menu-count">{{ stats.lostCount }}</text>
        <text class="menu-arrow">›</text>
      </view>
      
      <view class="menu-item" @click="goMyItems('found')">
        <text class="menu-icon">✨</text>
        <text class="menu-text">失物招领</text>
        <text class="menu-count">{{ stats.foundCount }}</text>
        <text class="menu-arrow">›</text>
      </view>
      
      <view class="menu-item" @click="goMyItems('all', 'solved')">
        <text class="menu-icon">✓</text>
        <text class="menu-text">已解决</text>
        <text class="menu-count">{{ stats.solvedCount }}</text>
        <text class="menu-arrow">›</text>
      </view>
      
      <view class="menu-item" @click="goSettings">
        <text class="menu-icon">⚙️</text>
        <text class="menu-text">设置</text>
        <text class="menu-arrow">›</text>
      </view>
      
      <view class="menu-item" @click="goBlockedUsers">
        <text class="menu-icon">🚫</text>
        <text class="menu-text">黑名单</text>
        <text class="menu-arrow">›</text>
      </view>
      
      <view class="menu-item donation" @click="goDonation">
        <text class="menu-icon">🧋</text>
        <text class="menu-text">请开发者喝奶茶</text>
        <text class="menu-arrow">›</text>
      </view>
      
      <view class="menu-item logout" @click="handleLogout">
        <text class="menu-icon">🚪</text>
        <text class="menu-text">退出登录</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>
    
    <view v-else class="guest-content">
      <view class="guest-card">
        <text class="guest-title">欢迎使用校园失物招领</text>
        <text class="guest-desc">登录后可以发布物品、查看消息</text>
        <button class="guest-btn" @click="goLogin">立即登录</button>
      </view>
    </view>
    
    <view class="tabbar-container">
      <view class="custom-tabbar">
        <view class="tab-container">
          <view 
            v-for="(item, index) in tabBarItems" 
            :key="index"
            class="tab-bar-item"
            :class="{ active: currentTabBarIndex === index }"
            @click="handleTabClick(index)"
          >
            <!-- 消息 Tab 加角标 -->
            <view v-if="index === 1 && unreadTotal > 0" class="tab-badge">
              <text>{{ unreadTotal > 99 ? '99+' : unreadTotal }}</text>
            </view>
            <text class="tab-icon">{{ item.icon }}</text>
            <text class="tab-text">{{ item.text }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { storage } from '@/utils/storage'
import { api } from '@/utils/api'

export default {
  data() {
    return {
      user: null,
      stats: {
        lostCount: 0,
        foundCount: 0,
        solvedCount: 0,
        totalCount: 0
      },
      tabBarItems: [
        { pagePath: '/pages/index/index', text: '首页', icon: '🏠' },
        { pagePath: '/pages/message/index', text: '消息', icon: '💬' },
        { pagePath: '/pages/item/publish', text: '发布', icon: '+' },
        { pagePath: '/pages/user/index', text: '我的', icon: '👤' }
      ],
      currentTabBarIndex: 3,
      unreadTotal: 0,
      pollTimer: null,
      statusBarHeight: 0
    }
  },
  onLoad() {
    this.getStatusBarHeight()
    this.loadUser()
  },
  onShow() {
    this.loadUser()
    this.loadStats()
    this.currentTabBarIndex = 3
    this.checkLoginAndLoadUnread()
    this.startPoll()
  },
  onHide() {
    this.stopPoll()
  },
  methods: {
    getStatusBarHeight() {
      try {
        const systemInfo = uni.getSystemInfoSync()
        this.statusBarHeight = systemInfo.statusBarHeight || 0
      } catch (e) {
        this.statusBarHeight = 0
      }
    },
    checkLoginAndLoadUnread() {
      const token = storage.getToken()
      if (token) {
        this.loadUnreadCount()
      } else {
        this.unreadTotal = 0
      }
    },
    async loadUnreadCount() {
      try {
        const res = await api.getMessages()
        const total = res.data.reduce((s, c) => s + (parseInt(c.unread) || 0), 0)
        this.unreadTotal = total
      } catch (e) {
        // 静默失败
      }
    },
    startPoll() {
      this.stopPoll()
      this.pollTimer = setInterval(() => {
        const token = storage.getToken()
        if (token) {
          this.loadUnreadCount()
        }
      }, 3000)
    },
    stopPoll() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },
    getFullImageUrl(url) {
      if (!url) return ''
      // 如果已经是完整URL，直接返回
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
      }
      // 如果是相对路径，拼接baseUrl
      const baseUrl = 'https://chentian.dpdns.org'
      return baseUrl + url
    },
    loadUser() {
      this.user = storage.getUser()
    },
    async loadStats() {
      if (!this.user) return
      
      try {
        const res = await api.getUserStats()
        const data = res.data || {}
        
        this.stats.lostCount = data.lostActive || data.lost || 0
        this.stats.foundCount = data.foundActive || data.found || 0
        this.stats.solvedCount = data.solved || 0
        this.stats.totalCount = data.total || 0
      } catch (err) {
        console.error('加载统计数据失败', err)
        await this.loadStatsFallback()
      }
    },
    async loadStatsFallback() {
      try {
        const res = await api.getUserItems({ type: 'all', status: 'all' })
        const items = res.data || []
        
        this.stats.lostCount = items.filter(item => item.type === 'lost' && item.status === 'active').length
        this.stats.foundCount = items.filter(item => item.type === 'found' && item.status === 'active').length
        this.stats.solvedCount = items.filter(item => item.status === 'solved').length
        this.stats.totalCount = items.length
      } catch (err) {
        console.error('加载统计数据失败(备用)', err)
      }
    },
    chooseAvatar() {
      if (!this.user) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          console.log('[用户中心] 选择图片成功:', res.tempFilePaths[0])
          const filePath = res.tempFilePaths[0]
          uni.showLoading({ title: '上传中...' })
          try {
            const result = await api.uploadImage(filePath)
            console.log('[用户中心] 上传成功:', result.url)
            
            await api.updateUserInfo({ avatar: result.url })
            
            this.user.avatar = result.url
            storage.setUser(this.user)
            
            uni.hideLoading()
            uni.showToast({ title: '头像更新成功', icon: 'success' })
          } catch (err) {
            uni.hideLoading()
            console.error('[用户中心] 上传失败:', err)
            uni.showToast({ title: err.message || '上传失败', icon: 'none', duration: 3000 })
          }
        },
        fail: (err) => {
          console.error('[用户中心] 选择图片失败:', err)
          uni.showToast({ title: '选择图片失败', icon: 'none' })
        }
      })
    },
    goLogin() {
      uni.navigateTo({ url: '/pages/auth/login' })
    },
    goEdit() {
      uni.navigateTo({ url: '/pages/user/edit' })
    },
    goMyItems(type, status = 'active') {
      uni.navigateTo({ url: `/pages/user/my-items?type=${type}&status=${status}` })
    },
    goSettings() {
      uni.navigateTo({ url: '/pages/user/settings' })
    },
    goBlockedUsers() {
      uni.navigateTo({ url: '/pages/user/blocked-users' })
    },
    goDonation() {
      uni.showModal({
        title: '请开发者喝杯奶茶',
        content: '感谢使用校园失物招领！\n您的支持是我持续开发的动力！\n\n点击下方按钮查看开发者信息和捐赠码',
        confirmText: '去看看',
        success: (res) => {
          if (res.confirm) {
            // 在 App 内打开 web-view 或者跳转到外部链接
            // 这里我们可以用 uni.navigateTo 打开一个页面，或者用 plus.runtime.openURL
            // 简单起见，先跳转到外部链接或 web-view
            uni.showToast({ 
              title: '正在打开...', 
              icon: 'loading' 
            })
            // 延迟一点再打开，避免 toast 立即被覆盖
            setTimeout(() => {
              // 尝试用 plus.runtime.openURL（APP 端）或其他方式
              // 首先尝试 webview，简单起见，我们先在 app 内打开 web-view
              // 但是用户可能没有 web-view 页面，所以我们用简单的方式
              // 先简单点，尝试用 uni.navigateTo 或者 web-view
              // 或者我们先弹出提示，告诉用户访问 /developer 页面
              uni.showModal({
                title: '前往捐赠',
                content: '请在浏览器中访问：\nhttps://chentian.dpdns.org/developer',
                showCancel: false,
                confirmText: '复制链接',
                success: (copyRes) => {
                  if (copyRes.confirm) {
                    uni.setClipboardData({
                      data: 'https://chentian.dpdns.org/developer',
                      success: () => {
                        uni.showToast({ title: '链接已复制', icon: 'success' })
                      }
                    })
                  }
                }
              })
            }, 500)
          }
        }
      })
    },
    handleLogout() {
      uni.showModal({
        title: '确认退出',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            storage.clearUser()
            this.user = null
            this.stats = { lostCount: 0, foundCount: 0, solvedCount: 0, totalCount: 0 }
            uni.showToast({ title: '退出成功', icon: 'success' })
          }
        }
      })
    },
    switchTab(index) {
      if (index !== this.currentTabBarIndex) {
        this.currentTabBarIndex = index
        uni.reLaunch({ url: this.tabBarItems[index].pagePath })
      }
    },
    handleTabClick(index) {
      this.switchTab(index)
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
}

.user-header {
  display: flex;
  align-items: center;
  padding: 60rpx 30rpx 40rpx;
  background: linear-gradient(135deg, #4f8cff 0%, #6c63ff 100%);
}

.avatar-wrapper {
  position: relative;
  margin-right: 25rpx;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-wrapper image.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.5);
}

.avatar-text {
  font-size: 48rpx;
  color: #4f8cff;
  font-weight: bold;
}

.avatar-edit {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 40rpx;
  height: 40rpx;
  background: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid rgba(255, 255, 255, 0.8);
}

.edit-icon {
  font-size: 20rpx;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 8rpx;
}

.user-class {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

.edit-btn, .login-btn {
  padding: 15rpx 30rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 30rpx;
}

.edit-btn text, .login-btn text {
  font-size: 26rpx;
  color: #fff;
}

.stats-section {
  display: flex;
  justify-content: space-around;
  align-items: center;
  margin: -30rpx 20rpx 20rpx;
  background: #ffffff;
  border-radius: 15rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
}

.stat-item {
  text-align: center;
  flex: 1;
}

.stat-num {
  font-size: 40rpx;
  font-weight: bold;
  color: #4f8cff;
  display: block;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}

.stat-divider {
  width: 1rpx;
  height: 60rpx;
  background: #f0f0f0;
}

.menu-list {
  margin: 20rpx;
  background: #ffffff;
  border-radius: 15rpx;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item.logout {
  color: #ff4444;
}

.menu-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}

.menu-text {
  flex: 1;
  font-size: 30rpx;
  color: #333;
}

.menu-count {
  font-size: 24rpx;
  color: #999;
  margin-right: 15rpx;
  background: #f5f5f5;
  padding: 5rpx 15rpx;
  border-radius: 20rpx;
}

.menu-item.logout .menu-text {
  color: #ff4444;
}

.menu-arrow {
  font-size: 36rpx;
  color: #ccc;
}

.guest-content {
  padding: 40rpx 20rpx;
}

.guest-card {
  background: #ffffff;
  border-radius: 15rpx;
  padding: 40rpx;
  text-align: center;
}

.guest-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 15rpx;
}

.guest-desc {
  font-size: 26rpx;
  color: #999;
  display: block;
  margin-bottom: 30rpx;
}

.guest-btn {
  width: 200rpx;
  height: 70rpx;
  background: linear-gradient(135deg, #4f8cff 0%, #6c63ff 100%);
  color: #fff;
  border-radius: 35rpx;
  font-size: 28rpx;
}

.tabbar-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 999;
}

.custom-tabbar {
  padding: 12rpx 0;
  padding-bottom: calc(12rpx + env(safe-area-inset-bottom));
  background: #fffffffff;
  border-top: 1rpx solid #eee;
}

.tab-container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 80rpx;
}

.tab-bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.tab-icon {
  font-size: 40rpx;
}

.tab-text {
  font-size: 24rpx;
  color: #666999;
  margin-top: 4rpx;
}

.tab-bar-item.active .tab-icon,
.tab-bar-item.active .tab-text {
  color: #4f8cff;
}

/* 消息角标 */
.tab-badge {
  position: absolute;
  top: -8rpx;
  right: 50%;
  transform: translateX(50rpx);
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  background: #ff4757;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  
  text {
    font-size: 20rpx;
    color: #fff;
    line-height: 1;
  }
}
</style>