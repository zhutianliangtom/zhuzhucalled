<template>
  <view class="container" :class="{ 'theme-dark': isDark }">
    <view class="header" :style="{ paddingTop: (statusBarHeight + 10) + 'px' }">
      <text class="title">消息</text>
    </view>
    
    <view v-if="conversations.length === 0" class="empty">
      <text class="empty-icon">💬</text>
      <text class="empty-text">暂无消息</text>
    </view>
    
    <view v-else class="conversation-list">
      <view 
        v-for="conv in conversations" 
        :key="conv.userId" 
        class="conversation-item"
        @click="goChat(conv.userId, conv.userName, conv.userAvatar)"
      >
        <view class="avatar">
          <image v-if="conv.userAvatar" :src="getFullImageUrl(conv.userAvatar)" mode="aspectFill" class="avatar-img" />
          <text v-else class="avatar-text">{{ (conv.userName || '?').charAt(0) }}</text>
        </view>
        <view class="conv-info">
          <view class="conv-header">
            <text class="conv-name">{{ conv.userName }}</text>
            <view class="header-right">
              <text class="conv-time">{{ format.formatTime(conv.lastTime) }}</text>
              <view v-if="conv.unread > 0" class="unread-badge">
                <text>{{ conv.unread }}</text>
              </view>
            </view>
          </view>
          <text class="conv-preview">{{ conv.lastMessage }}</text>
        </view>
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
import { api } from '@/utils/api'
import { format } from '@/utils/format'
import { storage } from '@/utils/storage'
import { cache } from '@/utils/cache'

export default {
  data() {
    return {
      format,
      isDark: false,
      conversations: [],
      tabBarItems: [
        { pagePath: '/pages/index/index', text: '首页', icon: '🏠' },
        { pagePath: '/pages/message/index', text: '消息', icon: '💬' },
        { pagePath: '/pages/item/publish', text: '发布', icon: '+' },
        { pagePath: '/pages/user/index', text: '我的', icon: '👤' }
      ],
      currentTabBarIndex: 1,
      unreadTotal: 0,
      pollTimer: null,
      _lastUnread: {},
      _notifyCooldown: {},
      _appInForeground: true,
      _loading: false,
      statusBarHeight: 0
    }
  },
  onLoad() {
    this.getStatusBarHeight()
    this.checkLoginAndLoad()
    this.startPoll()
    this.applyTheme()
    
    // 监听主题切换
    uni.$on('theme-change', ({ isDark }) => {
      this.isDark = isDark
    })
  },
  onUnload() {
    uni.$off('theme-change')
  },
  onShow() {
    this._appInForeground = true
    // 轮询已由 onLoad 启动，这里只更新角标和当前页状态
    this.updateBadge()
    this.currentTabBarIndex = 1
  },
  onHide() {
    this._appInForeground = false
  },
  onUnload() {
    this.stopPoll()
  },
  methods: {
    applyTheme() {
      const settings = storage.getSettings() || {}
      this.isDark = settings.theme === 'dark'
    },
    getStatusBarHeight() {
      try {
        const systemInfo = uni.getSystemInfoSync()
        this.statusBarHeight = systemInfo.statusBarHeight || 0
      } catch (e) {
        this.statusBarHeight = 0
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
    // 检查登录状态并加载对话列表
    checkLoginAndLoad() {
      const token = storage.getToken()
      if (token) {
        this.loadConversations()
      } else {
        // 未登录状态下显示空列表
        this.conversations = []
        this.unreadTotal = 0
      }
    },
    async loadConversations(force) {
      if (this._loading) return
      this._loading = true
      try {
        const userId = (storage.getUser() || {}).id || 'anon'
        const isFirst = Object.keys(this._lastUnread).length === 0
        await cache.fetch('conv_' + userId, () => api.getMessages(), {
          ttl: cache.TTL.messages,
          force,
          onLoad: (cached) => {
            if (cached && cached.data) {
              this.conversations = cached.data
              if (isFirst) this._seedUnread()
              this.updateUnreadTotal(true)
            }
          },
          onRefresh: (fresh) => {
            this.conversations = (fresh && fresh.data) ? fresh.data : []
            if (isFirst) this._seedUnread()
            this.updateUnreadTotal(false)
          }
        })
      } catch (err) {
        if (err.message !== '登录已过期') console.error(err)
      } finally {
        this._loading = false
      }
    },
    // 种子化 _lastUnread，避免首次加载把已有未读当新消息
    _seedUnread() {
      this.conversations.forEach(c => {
        this._lastUnread[c.userId] = parseInt(c.unread) || 0
      })
    },

    startPoll() {
      this.stopPoll()
      this.pollTimer = setInterval(() => {
        const token = storage.getToken()
        if (token) this.loadConversations()
      }, 5000)
    },
    stopPoll() {
      if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
    },

    // 更新未读总数 + 增量通知
    updateUnreadTotal(skipNotify) {
      const total = this.conversations.reduce((s, c) => s + (parseInt(c.unread) || 0), 0)
      this.unreadTotal = total
      this.updateBadge()

      if (skipNotify) return

      this.conversations.forEach(c => {
        const cur = parseInt(c.unread) || 0
        const prev = parseInt(this._lastUnread[c.userId]) || 0
        if (cur > prev) {
          // 只在新消息到达时弹一次
          this.showLocalNotification(c)
        }
        this._lastUnread[c.userId] = cur
      })
    },

    updateBadge() {
      const total = this.unreadTotal
      if (typeof plus !== 'undefined' && plus.runtime) {
        plus.runtime.setBadgeNumber(total)
      }
    },

    showLocalNotification(conversation) {
      // 前台静默，只更新角标；后台才发系统通知
      if (this._appInForeground) return

      const now = Date.now()
      if (this._notifyCooldown[conversation.userId] && now - this._notifyCooldown[conversation.userId] < 10000) return
      this._notifyCooldown[conversation.userId] = now

      // #ifdef APP-PLUS
      const text = `${conversation.userName}: ${conversation.lastMessage || '新消息'}`
      if (typeof plus !== 'undefined' && plus.push) {
        plus.push.createMessage(text,
          JSON.stringify({ userId: conversation.userId, userName: conversation.userName }),
          { title: '校园失物招领', sound: 'system', cover: false }
        )
      }
      // #endif
    },

    goChat(userId, userName, userAvatar) {
      const encodedName = encodeURIComponent(userName || '未知用户')
      const avatar = userAvatar || ''
      uni.navigateTo({ url: `/pages/message/chat?userId=${userId}&userName=${encodedName}&userAvatar=${avatar}` })
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
  background: #f8f9fa;
}

.header {
  padding: 30rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #eee;
}

.title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 150rpx 0;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

.conversation-list {
  padding: 20rpx;
}

.conversation-item {
  display: flex;
  background: #ffffff;
  border-radius: 15rpx;
  padding: 20rpx;
  margin-bottom: 15rpx;
}

.avatar {
  width: 80rpx;
  height: 80rpx;
  background: #2563eb;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.avatar-text {
  font-size: 36rpx;
  color: #fff;
  font-weight: bold;
}

.conv-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}

.conv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.unread-badge {
  background: #ff4757;
  color: #fff;
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 20rpx;
  min-width: 32rpx;
  text-align: center;
}

.conv-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.conv-time {
  font-size: 22rpx;
  color: #999;
}

.conv-preview {
  font-size: 26rpx;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ─── Tab Bar ─── */
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
  background: #ffffff;
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
  position: relative;
}

/* 消息 Tab 角标 */
.tab-badge {
  position: absolute;
  top: -4rpx;
  right: 50%;
  transform: translateX(60rpx);
  background: #ff4757;
  color: #fff;
  font-size: 18rpx;
  padding: 0 10rpx;
  border-radius: 20rpx;
  min-width: 28rpx;
  height: 32rpx;
  line-height: 32rpx;
  text-align: center;
  z-index: 10;
}

.tab-icon {
  font-size: 40rpx;
}

.tab-text {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
}

.tab-bar-item.active .tab-icon,
.tab-bar-item.active .tab-text {
  color: #2563eb;
}
</style>
