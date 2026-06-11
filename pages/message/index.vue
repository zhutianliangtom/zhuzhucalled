<template>
  <view class="container" :class="{ 'theme-dark': isDark }">
    <view class="header" :style="{ paddingTop: (statusBarHeight + 10) + 'px' }">
      <text class="title">消息</text>
    </view>
    
    <view v-if="conversations.length === 0" class="empty">
      <text class="empty-icon">💬</text>
      <text class="empty-text">{{ hasToken ? '暂无消息' : '登录后可以查看和发送消息' }}</text>
      <button v-if="!hasToken" class="empty-btn" @click="goLogin">立即登录</button>
    </view>
    
    <view v-else class="conversation-list">
      <view 
        v-for="conv in conversations" 
        :key="conv.userId" 
        class="conversation-item"
        @click="goChat(conv.userId, conv.userName, conv.userAvatar)"
      >
        <view class="avatar">
        <simple-cached-image v-if="conv.userAvatar" :src="getFullImageUrl(conv.userAvatar)" mode="aspectFill" class="avatar-img" />
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
          <text class="conv-preview">{{ getLastMessagePreview(conv) }}</text>
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
            <image :src="currentTabBarIndex === index ? item.activeIconPath : item.iconPath" class="tab-icon" />
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
import { notification } from '@/utils/notification'
import SimpleCachedImage from '@/components/SimpleCachedImage.vue'

export default {
  components: {
    SimpleCachedImage
  },
  data() {
    return {
      format,
      isDark: false,
      conversations: [],
      hasToken: false,
      tabBarItems: [
        { pagePath: '/pages/index/index', iconPath: '/static/tab/home.png', activeIconPath: '/static/tab/home.png' },
        { pagePath: '/pages/message/index', iconPath: '/static/tab/message.png', activeIconPath: '/static/tab/message.png' },
        { pagePath: '/pages/item/publish', iconPath: '/static/tab/publish.png', activeIconPath: '/static/tab/publish.png' },
        { pagePath: '/pages/user/index', iconPath: '/static/tab/user.png', activeIconPath: '/static/tab/user.png' }
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
  onShow() {
    this._appInForeground = true
    // ????????????????????????????????
    if (typeof notification !== `undefined` && notification.setForeground) {
      notification.setForeground(true)
      notification.setActiveChatUser(``)
    }
    this.updateBadge()
    this.currentTabBarIndex = 1
  },
  onHide() {
    this._appInForeground = false
    // ???????????
    if (typeof notification !== `undefined` && notification.setForeground) {
      notification.setForeground(false)
    }
  },
  onUnload() {
    uni.$off('theme-change')
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
      this.hasToken = !!token
      if (token) {
        this.loadConversations()
      } else {
        // 未登录状态下显示空列表
        this.conversations = []
        this.unreadTotal = 0
      }
    },
    goLogin() {
      uni.navigateTo({ url: '/pages/auth/login' })
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
        // 静默失败
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
      const now = Date.now()
      if (this._notifyCooldown[conversation.userId] && now - this._notifyCooldown[conversation.userId] < 10000) return
      this._notifyCooldown[conversation.userId] = now

      // #ifdef APP-PLUS
      const userName = conversation.userName || '未知用户'
      const content = conversation.lastMessage || '新消息'
      
      notification.showMessageNotification(
        conversation.userId,
        userName,
        content,
        conversation.userAvatar
      )
      // #endif
    },

    async goChat(userId, userName, userAvatar) {
      try {
        await api.markConversationRead(userId)
      } catch (e) {}
      
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
    },
    /**
     * 获取最后一条消息的预览文本
     * 如果是图片或视频，显示对应的标签
     */
    getLastMessagePreview(conv) {
      // 先尝试获取所有可能的字段
      const lastMsg = conv.lastMessage || conv.lastMsg || conv.last_message || ''
      const msgType = conv.lastMessageType || conv.lastMsgType || conv.last_message_type || conv.type || ''
      const mediaUrl = conv.lastMediaUrl || conv.mediaUrl || conv.media_url || conv.thumbUrl || conv.thumb_url || conv.picUrl || conv.pic_url || conv.videoUrl || conv.video_url || ''
      
      // 如果内容已经包含标签，直接返回
      if (typeof lastMsg === 'string') {
        const lowerMsg = lastMsg.toLowerCase()
        if (lowerMsg.includes('[图片]') || lowerMsg.includes('[照片]')) {
          return '[图片]'
        }
        if (lowerMsg.includes('[视频]')) {
          return '[视频]'
        }
      }
      
      // 如果明确有消息类型
      if (msgType === 'image') {
        return '[图片]'
      }
      if (msgType === 'video') {
        return '[视频]'
      }
      
      // 如果内容为空或只有空格
      if (!lastMsg || (typeof lastMsg === 'string' && lastMsg.trim() === '')) {
        // 检查是否有媒体URL
        if (mediaUrl && typeof mediaUrl === 'string') {
          const url = mediaUrl.toLowerCase()
          // 判断是否是视频
          if (url.includes('.mp4') || url.includes('.mov') || url.includes('.avi') || url.includes('.mkv') || url.includes('.webm') || url.includes('.3gp')) {
            return '[视频]'
          }
          // 判断是否是图片
          if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif') || url.includes('.webp') || url.includes('.bmp')) {
            return '[图片]'
          }
          // 有URL但无法判断类型，默认显示[图片]
          return '[图片]'
        }
        // 如果有 lastMessage 是对象但内容为空
        if (lastMsg && typeof lastMsg === 'object') {
          // 尝试从对象中获取类型
          const objType = lastMsg.type || lastMsg.msgType || ''
          if (objType === 'image') return '[图片]'
          if (objType === 'video') return '[视频]'
          // 尝试判断对象中是否有媒体URL
          const objMediaUrl = lastMsg.mediaUrl || lastMsg.media_url || lastMsg.thumbUrl || lastMsg.thumb_url || lastMsg.url || ''
          if (objMediaUrl) {
            const url = objMediaUrl.toLowerCase()
            if (url.includes('.mp4') || url.includes('.mov') || url.includes('.avi')) return '[视频]'
            return '[图片]'
          }
        }
        // 完全没有内容但在聊天列表中，默认显示[图片]
        return '[图片]'
      }
      
      // 如果有内容但可能是图片/视频的路径
      if (typeof lastMsg === 'string') {
        const lowerMsg = lastMsg.toLowerCase()
        if (lowerMsg.includes('.jpg') || lowerMsg.includes('.jpeg') || lowerMsg.includes('.png') || lowerMsg.includes('.gif')) {
          return '[图片]'
        }
        if (lowerMsg.includes('.mp4') || lowerMsg.includes('.mov') || lowerMsg.includes('.avi')) {
          return '[视频]'
        }
      }
      
      // 正常返回文本内容
      return lastMsg
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
  margin-bottom: 30rpx;
}

.empty-btn {
  width: 200rpx;
  height: 70rpx;
  background: #334155;
  color: #fff;
  border-radius: 35rpx;
  font-size: 28rpx;
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
  background: #334155;
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
  height: 56rpx;
}

.tab-bar-item {
  flex: 1;
  display: flex;
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

/* PNG图标样式 - 带边缘泛光效果 */
.tab-icon {
  width: 64rpx;
  height: 64rpx;
  transition: all 0.2s;
}
.tab-bar-item .tab-icon {
  opacity: 0.55;
  filter: drop-shadow(0 0 6rpx rgba(0, 0, 0, 0.25));
}
.tab-bar-item.active .tab-icon {
  opacity: 1;
  filter: drop-shadow(0 0 12rpx rgba(51, 65, 85, 0.7)) drop-shadow(0 0 24rpx rgba(51, 65, 85, 0.5)) drop-shadow(0 0 36rpx rgba(51, 65, 85, 0.3));
}
</style>
