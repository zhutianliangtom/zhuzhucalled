<template>
  <view class="container">
    <view class="header">
      <text class="title">黑名单管理</text>
      <text class="subtitle">已拉黑的用户将无法给你发送消息</text>
    </view>
    
    <view v-if="loading" class="loading">
      <text>加载中...</text>
    </view>
    
    <view v-else-if="blockedUsers.length === 0" class="empty">
      <text class="empty-icon">🚫</text>
      <text class="empty-text">暂无拉黑用户</text>
    </view>
    
    <view v-else class="blocked-list">
      <view 
        v-for="user in blockedUsers" 
        :key="user.id" 
        class="blocked-item"
      >
        <view class="user-info">
          <view class="avatar">
            <image v-if="user.avatar" :src="getFullImageUrl(user.avatar)" mode="aspectFill" class="avatar-img" />
            <text v-else class="avatar-text">{{ (user.name || '?').charAt(0) }}</text>
          </view>
          <view class="info">
            <text class="user-name">{{ user.name || '校园用户' }}</text>
            <text class="user-id">ID: {{ user.id }}</text>
          </view>
        </view>
        <view class="actions">
          <button class="unblock-btn" @click="confirmUnblock(user)">取消拉黑</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { cache } from '@/utils/cache'

export default {
  data() {
    return {
      blockedUsers: [],
      loading: true
    }
  },
  onLoad() {
    this.loadBlockedUsers()
  },
  methods: {
    getFullImageUrl(url) {
      if (!url) return ''
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
      }
      const baseUrl = 'https://chentian.dpdns.org'
      return baseUrl + url
    },
    async loadBlockedUsers() {
      this.loading = true
      try {
        await cache.fetch('blocked_users', () => api.getBlockedUsers(), {
          ttl: 60,
          onLoad: (cached) => {
            if (cached && cached.data) this.blockedUsers = cached.data
          },
          onRefresh: (fresh) => {
            if (fresh && fresh.data) this.blockedUsers = fresh.data
          }
        })
      } catch (err) {} finally {
        this.loading = false
      }
    },
    confirmUnblock(user) {
      uni.showModal({
        title: '取消拉黑',
        content: `确定要取消拉黑 "${user.name || '校园用户'}" 吗？`,
        confirmText: '取消拉黑',
        confirmColor: '#334155',
        success: async (res) => {
          if (res.confirm) {
            await this.unblockUser(user)
          }
        }
      })
    },
    async unblockUser(user) {
      try {
        await api.unblockUser(user.id)
        uni.showToast({ title: '已取消拉黑', icon: 'success' })
        // 重新加载列表
        this.loadBlockedUsers()
      } catch (err) {
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
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
  display: block;
  margin-bottom: 10rpx;
}

.subtitle {
  font-size: 24rpx;
  color: #999;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;
  
  text {
    font-size: 28rpx;
    color: #999;
  }
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

.blocked-list {
  padding: 20rpx;
}

.blocked-item {
  background: #ffffff;
  border-radius: 15rpx;
  padding: 25rpx;
  margin-bottom: 15rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-info {
  display: flex;
  align-items: center;
  flex: 1;
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

.info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.user-id {
  font-size: 22rpx;
  color: #999;
}

.actions {
  flex-shrink: 0;
}

.unblock-btn {
  padding: 12rpx 30rpx;
  background: #ffffff;
  color: #334155;
  border: 2rpx solid #334155;
  border-radius: 30rpx;
  font-size: 26rpx;
  line-height: 1.5;
  
  &::after {
    border: none;
  }
}
</style>
