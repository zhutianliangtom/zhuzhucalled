<template>
  <view class="container" :class="{ dark: darkMode }">
    <view class="header">
      <text class="header-title">设置</text>
      <view class="back-btn" @click="goBack">
        <text>‹</text>
      </view>
    </view>
    
    <view class="settings-list">
      <view class="settings-item">
        <text class="settings-icon">🔔</text>
        <text class="settings-text">消息通知</text>
        <switch :checked="notifications" @change="toggleNotifications" color="#4f8cff" />
      </view>
      
      <view class="settings-item">
        <text class="settings-icon">🌙</text>
        <text class="settings-text">深色模式</text>
        <switch :checked="darkMode" @change="toggleDarkMode" color="#4f8cff" />
      </view>
      
      <view class="settings-item" @click="clearCache">
        <text class="settings-icon">🗑️</text>
        <text class="settings-text">清除缓存</text>
        <text class="settings-arrow">›</text>
      </view>
      
      <view class="settings-item" @click="showAbout">
        <text class="settings-icon">ℹ️</text>
        <text class="settings-text">关于我们</text>
        <text class="settings-arrow">›</text>
      </view>
    </view>
    
    <view class="version-info">
      <text class="version-text">版本 1.0.0</text>
    </view>
  </view>
</template>

<script>
import { storage } from '@/utils/storage'

export default {
  data() {
    return {
      notifications: true,
      darkMode: false
    }
  },
  onLoad() {
    this.loadSettings()
  },
  methods: {
    loadSettings() {
      const settings = storage.getSettings() || {}
      this.darkMode = settings.theme === 'dark'
    },
    goBack() {
      uni.navigateBack()
    },
    toggleNotifications(e) {
      this.notifications = e.detail.value
      uni.showToast({
        title: this.notifications ? '已开启通知' : '已关闭通知',
        icon: 'none'
      })
    },
    toggleDarkMode(e) {
      this.darkMode = e.detail.value
      const settings = storage.getSettings() || {}
      settings.theme = this.darkMode ? 'dark' : 'light'
      storage.setSettings(settings)

      // 通知 App.vue 切换主题
      uni.$emit('theme-change', { isDark: this.darkMode })

      uni.showToast({
        title: this.darkMode ? '已切换到深色模式' : '已切换到浅色模式',
        icon: 'none'
      })
    },
    clearCache() {
      uni.showModal({
        title: '清除缓存',
        content: '确定要清除应用缓存吗？',
        success: (res) => {
          if (res.confirm) {
            try {
              uni.clearStorageSync()
              uni.showToast({ title: '缓存已清除', icon: 'success' })
            } catch (err) {
              uni.showToast({ title: '清除失败', icon: 'none' })
            }
          }
        }
      })
    },
    showAbout() {
      uni.showModal({
        title: '关于校园失物招领',
        content: '校园失物招领App帮助同学们快速找回丢失的物品，让每一件失物都能回家。',
        showCancel: false
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
}

.container.dark {
  background: #1a1a1a;
}

.header {
  display: flex;
  align-items: center;
  padding: 60rpx 30rpx 30rpx;
  background: #ffffff;
}

.container.dark .header {
  background: #2a2a2a;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.back-btn text {
  font-size: 48rpx;
  color: #333;
}

.container.dark .back-btn text {
  color: #fff;
}

.header-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.container.dark .header-title {
  color: #fff;
}

.settings-list {
  margin: 20rpx;
  background: #ffffff;
  border-radius: 15rpx;
  overflow: hidden;
}

.container.dark .settings-list {
  background: #2a2a2a;
}

.settings-item {
  display: flex;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
}

.container.dark .settings-item {
  border-bottom-color: #3a3a3a;
}

.settings-item:last-child {
  border-bottom: none;
}

.settings-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}

.settings-text {
  flex: 1;
  font-size: 30rpx;
  color: #333;
}

.container.dark .settings-text {
  color: #fff;
}

.settings-arrow {
  font-size: 36rpx;
  color: #ccc;
}

.container.dark .settings-arrow {
  color: #999;
}

.version-info {
  text-align: center;
  padding: 40rpx;
}

.version-text {
  font-size: 24rpx;
  color: #999;
}

.container.dark .version-text {
  color: #999;
}
</style>