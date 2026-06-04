<template>
  <view class="container" :class="{ 'theme-dark': isDark }">
    <view v-if="item" class="content">
      <view class="image-gallery">
        <image 
          v-for="(img, index) in item.images" 
          :key="index" 
          :src="getFullImageUrl(img)" 
          mode="widthFix" 
          class="gallery-image" 
          @click="previewImage(index)"
        />
      </view>
      
      <view class="info-card">
        <view class="item-header">
          <text class="item-tag" :class="item.type">{{ item.type === 'lost' ? '寻物启事' : '失物招领' }}</text>
          <text v-if="item.status === 'solved'" class="status-tag solved">✓ 已解决</text>
        </view>
        
        <!-- 发布时间 -->
        <view class="publish-time">
          <text class="time-icon">🕒</text>
          <text class="time-text">发布于 {{ getLocalTimeString(item.createdAt) }}</text>
        </view>
        
        <text class="item-title">{{ item.title }}</text>
        
        <text class="item-desc">{{ item.description }}</text>
        
        <view class="contact-info">
          <text class="contact-label">联系方式</text>
          <text class="contact-value">{{ item.contact }}</text>
        </view>
        
        <view class="user-info">
          <view class="avatar">
            <image v-if="item.userAvatar" :src="getFullImageUrl(item.userAvatar)" class="avatar-img" mode="aspectFill" />
            <text v-else class="avatar-text">{{ (item.userName || '?').charAt(0) }}</text>
          </view>
          <view class="user-detail">
            <text class="user-name">{{ item.userName || '校园用户' }}</text>
            <text class="user-class">{{ item.userClassName || '' }}</text>
          </view>
        </view>
      </view>
    </view>
    
    <view v-else class="loading">
      <text>加载中...</text>
    </view>
    
    <view v-if="item" class="footer">
      <view v-if="isOwnItem && item.status === 'active'" class="footer-buttons">
        <button class="solve-btn" @click="solveItem">
          <text>✓ 已解决</text>
        </button>
        <button class="delete-btn" @click="deleteItem">
          <text>🗑️ 删除</text>
        </button>
      </view>
      <view v-else-if="isOwnItem && item.status === 'solved'" class="footer-buttons">
        <button class="delete-btn" @click="deleteItem">
          <text>🗑️ 删除</text>
        </button>
      </view>
      <button v-else class="chat-btn" @click="goChat">
        <text class="chat-icon">💬</text>
        <text>联系对方</text>
      </button>
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
      item: null,
      itemId: null,
      isOwnItem: false
    }
  },
  onLoad(options) {
    if (options?.id) {
      this.itemId = options.id
      this.loadItem()
    }
    this.applyTheme()
    
    // 监听主题切换
    uni.$on('theme-change', ({ isDark }) => {
      this.isDark = isDark
    })
  },
  onUnload() {
    uni.$off('theme-change')
  },
  methods: {
    applyTheme() {
      const settings = storage.getSettings() || {}
      this.isDark = settings.theme === 'dark'
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
    getLocalTimeString(timestamp) {
      // 使用Windows本地时间API
      const date = new Date(timestamp * 1000)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}`
    },
    previewImage(index) {
      // 图片预览功能
      const urls = this.item.images.map(img => this.getFullImageUrl(img))
      uni.previewImage({
        urls: urls,
        current: index
      })
    },
    async loadItem() {
      try {
        await cache.fetch('item_' + this.itemId, () => api.getItem(this.itemId), {
          ttl: 30,
          onLoad: (cached) => {
            // 缓存秒显
            if (cached && cached.data) {
              this.item = cached.data
              this.checkOwnership()
            }
          },
          onRefresh: (fresh) => {
            uni.hideLoading()
            if (fresh && fresh.data) {
              this.item = fresh.data
              this.checkOwnership()
            }
          }
        })
      } catch (err) {
        uni.hideLoading()
        console.error(err)
      }
    },
    checkOwnership() {
      const user = storage.getUser()
      if (user && this.item && this.item.userId === user.id) {
        this.isOwnItem = true
      }
    },
        uni.hideLoading()
      }
    },
    goChat() {
      const user = storage.getUser()
      if (!user) {
        uni.showModal({
          title: '提示',
          content: '请先登录后再进行私聊',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              uni.navigateTo({ url: '/pages/auth/login' })
            }
          }
        })
        return
      }
      
      if (this.item?.userId) {
        const userName = encodeURIComponent(this.item.userName || '未知用户')
        const userAvatar = this.item.userAvatar || ''
        uni.navigateTo({ url: `/pages/message/chat?userId=${this.item.userId}&userName=${userName}&userAvatar=${userAvatar}` })
      }
    },
    solveItem() {
      uni.showModal({
        title: '确认解决',
        content: '确定物品已经找回或归还了吗？',
        success: async (res) => {
          if (res.confirm) {
            uni.showLoading({ title: '处理中...' })
            try {
              await api.solveItem(this.itemId)
              uni.hideLoading()
              uni.showToast({ title: '已标记为解决', icon: 'success' })
              this.item.status = 'solved'
            } catch (err) {
              uni.hideLoading()
              uni.showToast({ title: '操作失败', icon: 'none' })
            }
          }
        }
      })
    },
    deleteItem() {
      uni.showModal({
        title: '删除确认',
        content: '确定要删除这个物品吗？',
        success: async (res) => {
          if (res.confirm) {
            uni.showLoading({ title: '删除中...' })
            try {
              await api.deleteItem(this.itemId)
              uni.hideLoading()
              uni.showToast({ title: '删除成功', icon: 'success' })
              setTimeout(() => {
                uni.navigateBack()
              }, 1500)
            } catch (err) {
              uni.hideLoading()
              uni.showToast({ title: '删除失败', icon: 'none' })
            }
          }
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 140rpx;
}

.content {
  padding-bottom: 20rpx;
}

.image-gallery {
  width: 100%;
  padding: 0;
  background: #ffffff;
}

.gallery-image {
  width: 100%;
  margin-bottom: 0;
  border-radius: 0;
  display: block;
}

/* 最后一张图片不需要底部边距 */
.gallery-image:last-child {
  margin-bottom: 0;
}

.info-card {
  margin: 20rpx;
  background: #ffffff;
  border-radius: 15rpx;
  padding: 30rpx;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 15rpx;
  margin-bottom: 20rpx;
  flex-wrap: wrap;
}

.item-tag {
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}

.item-tag.lost {
  background: #fff3e0;
  color: #ff9800;
}

.item-tag.found {
  background: #e3f2fd;
  color: #1976d2;
}

.status-tag {
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}

.status-tag.solved {
  background: #e8f5e9;
  color: #4caf50;
}

.publish-time {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin: 15rpx 0;
  padding: 15rpx;
  background: #f5f5f5;
  border-radius: 10rpx;
}

.time-icon {
  font-size: 28rpx;
}

.time-text {
  font-size: 24rpx;
  color: #999;
}

.item-time {
  font-size: 24rpx;
  color: #999;
  margin-left: auto;
}

.item-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}

.item-desc {
  font-size: 28rpx;
  color: #999;
  line-height: 1.8;
  margin-bottom: 30rpx;
  display: block;
}

.contact-info {
  background: #f9f9f9;
  border-radius: 10rpx;
  padding: 20rpx;
  margin-bottom: 30rpx;
}

.contact-label {
  font-size: 26rpx;
  color: #999;
  margin-right: 15rpx;
}

.contact-value {
  font-size: 28rpx;
  color: #333;
}

.user-info {
  display: flex;
  align-items: center;
  padding-top: 20rpx;
  border-top: 1rpx solid #eee;
}

.avatar {
  width: 70rpx;
  height: 70rpx;
  background: #2563eb;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-text {
  font-size: 32rpx;
  color: #fff;
  font-weight: bold;
}

.user-detail {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
}

.user-class {
  font-size: 24rpx;
  color: #999;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300rpx;
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx;
  background: #ffffff;
  border-top: 1rpx solid #eee;
}

.footer-buttons {
  display: flex;
  gap: 20rpx;
}

.chat-btn {
  width: 100%;
  height: 88rpx;
  background: #2563eb;
  color: #fff;
  border-radius: 44rpx;
  font-size: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.solve-btn {
  flex: 1;
  height: 88rpx;
  background: #4caf50;
  color: #fff;
  border-radius: 44rpx;
  font-size: 32rpx;
}

.delete-btn {
  flex: 1;
  height: 88rpx;
  background: #ff4757;
  color: #fff;
  border-radius: 44rpx;
  font-size: 32rpx;
}

.chat-icon {
  margin-right: 10rpx;
}
</style>