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
      
      <view class="settings-item" @click="checkLuck">
        <text class="settings-icon">🍀</text>
        <text class="settings-text">今日人品</text>
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
      <text class="version-text">版本 1.1.7</text>
    </view>
    
    <!-- 人品弹窗 -->
    <view v-if="luckVisible" class="luck-modal" @click="closeLuckModal">
      <view class="luck-modal-content" @click.stop>
        <view class="luck-modal-header">
          <text class="luck-modal-title">🍀 今日人品</text>
          <text class="luck-modal-close" @click="closeLuckModal">✕</text>
        </view>
        
        <view class="luck-modal-body">
          <view v-if="luckLoading" class="luck-loading">
            <text class="loading-text">获取中...</text>
          </view>
          
          <view v-else-if="luckData" class="luck-content">
            <text class="luck-icon-big">{{ getLuckIcon(luckData.luck) }}</text>
            <text class="luck-value-big" :style="{ color: luckData.color }">{{ luckData.luck }}</text>
            <text class="luck-comment-text">{{ luckData.comment }}</text>
            <text class="luck-tip-text">{{ luckToday ? '明天再来看看吧！' : '每个账号每天只能查看一次' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api.js'
import { storage } from '@/utils/storage'

export default {
  data() {
    return {
      notifications: true,
      luckVisible: false,
      luckData: null,
      luckLoading: false,
      luckToday: false
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
    async checkUpdate() {
      uni.showLoading({ title: '检查更新中...' })
      
      try {
        // #ifdef APP-PLUS
        let currentVersion = '1.1.7'
        let currentVersionCode = 0
        
        // 尝试获取真实版本号
        try {
          if (typeof plus !== 'undefined' && plus && plus.runtime) {
            currentVersionCode = parseInt(plus.runtime.versionCode) || 0
          }
        } catch (e) {}
        
        const res = await api.getLatestVersion()
        
        if (res && res.data) {
          const latest = res.data
          
          if (latest.versionCode > currentVersionCode) {
            uni.hideLoading()
            uni.showModal({
              title: `发现新版本 v${latest.version}`,
              content: latest.changelog || '点击确定前往下载页面',
              confirmText: '立即更新',
              showCancel: latest.forceUpdate !== true,
              success: (modalRes) => {
                if (modalRes.confirm) {
                  api.getEncryptedDownloadUrl(latest.id).then(downloadRes => {
                    const encryptedUrl = downloadRes?.data?.url || ''
                    const downloadPageUrl = `https://chentian.dpdns.org/download?token=${encodeURIComponent(encryptedUrl)}`
                    
                    if (typeof plus !== 'undefined' && plus && plus.runtime) {
                      plus.runtime.openURL(downloadPageUrl)
                    }
                  }).catch(() => {
                    const downloadUrl = 'https://chentian.dpdns.org/download'
                    if (typeof plus !== 'undefined' && plus && plus.runtime) {
                      plus.runtime.openURL(downloadUrl)
                    }
                  })
                }
                if (latest.forceUpdate === true && !modalRes.confirm) {
                  try {
                    if (typeof plus !== 'undefined' && plus && plus.runtime) {
                      plus.runtime.quit()
                    }
                  } catch (e) {}
                }
              }
            })
          } else {
            uni.hideLoading()
            uni.showToast({ title: '当前已是最新版本', icon: 'none' })
          }
        } else {
          uni.hideLoading()
          uni.showToast({ title: '暂无版本更新信息', icon: 'none' })
        }
        // #endif
        
        // #ifndef APP-PLUS
        // 非APP平台的处理
        uni.hideLoading()
        uni.showToast({ title: '当前已是最新版本', icon: 'none' })
        // #endif
      } catch (e) {
        uni.hideLoading()
        uni.showToast({ title: '检查更新失败，请检查网络', icon: 'none' })
      }
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
    },
    async checkLuck() {
      const user = storage.getUser()
      if (!user) {
        uni.showModal({
          title: '提示',
          content: '请先登录后再查看今日人品',
          confirmText: '去登录',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              uni.navigateTo({ url: '/pages/auth/login' })
            }
          }
        })
        return
      }
      
      if (this.luckToday) {
        this.luckVisible = true
        return
      }
      
      this.luckLoading = true
      
      try {
        const res = await api.getTodayLuckUser()
        if (res && res.data) {
          this.luckData = res.data
          this.luckToday = true
        }
      } catch (e) {
        uni.showToast({
          title: '获取失败',
          icon: 'none'
        })
      } finally {
        this.luckLoading = false
        this.luckVisible = true
      }
    },
    closeLuckModal() {
      this.luckVisible = false
    },
    getLuckIcon(luck) {
      if (luck >= 96) return '👑'
      if (luck >= 81) return '🌟'
      if (luck >= 61) return '😊'
      if (luck >= 41) return '😐'
      if (luck >= 21) return '😕'
      return '💀'
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
  
  /* 人品弹窗样式 */
  .luck-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .luck-modal-content {
    width: 600rpx;
    background: #fff;
    border-radius: 24rpx;
    overflow: hidden;
    box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.2);
  }
  
  .luck-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 30rpx;
    border-bottom: 1rpx solid #eee;
  }
  
  .luck-modal-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
  }
  
  .luck-modal-close {
    font-size: 36rpx;
    color: #999;
    padding: 10rpx;
  }
  
  .luck-modal-body {
    padding: 40rpx 30rpx;
  }
  
  .luck-loading {
    text-align: center;
    padding: 40rpx;
  }
  
  .loading-text {
    font-size: 28rpx;
    color: #999;
  }
  
  .luck-content {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .luck-icon-big {
    font-size: 100rpx;
    margin-bottom: 20rpx;
  }
  
  .luck-value-big {
    font-size: 80rpx;
    font-weight: 700;
    margin-bottom: 20rpx;
  }
  
  .luck-comment-text {
    font-size: 28rpx;
    color: #666;
    margin-bottom: 20rpx;
  }
  
  .luck-tip-text {
    font-size: 24rpx;
    color: #999;
  }
</style>