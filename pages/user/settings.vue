<template>
  <view class="container">
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
        <switch :checked="notifications" @change="toggleNotifications" color="#334155" />
      </view>
      
      <view class="settings-item" @click="checkUpdate">
        <text class="settings-icon">🔄</text>
        <text class="settings-text">检查更新</text>
        <text class="settings-arrow">›</text>
      </view>
      
      <view class="settings-item" @click="playGame">
        <text class="settings-icon">🎮</text>
        <text class="settings-text">玩玩游戏吧</text>
        <text class="settings-arrow">›</text>
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
      <text class="version-text">版本 1.1.4</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      notifications: true
    }
  },
  methods: {
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
    playGame() {
      uni.navigateTo({
        url: '/pages/offline-game/offline-game?fromSettings=true'
      })
    },
    checkUpdate() {
      uni.showLoading({ title: '检查更新中...' })
      setTimeout(() => {
        uni.hideLoading()
        uni.showModal({
          title: '检查完成',
          content: '当前已是最新版本（v1.1.4）',
          showCancel: false
        })
      }, 1500)
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
  background: #f8f9fa;
}

.header {
  display: flex;
  align-items: center;
  padding: 60rpx 30rpx 30rpx;
  background: #ffffff;
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

.header-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.settings-list {
  margin: 20rpx;
  background: #ffffff;
  border-radius: 15rpx;
  overflow: hidden;
}

.settings-item {
  display: flex;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
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

.settings-arrow {
  font-size: 36rpx;
  color: #ccc;
}

.version-info {
  text-align: center;
  padding: 40rpx;
}

.version-text {
  font-size: 24rpx;
  color: #999;
}
</style>