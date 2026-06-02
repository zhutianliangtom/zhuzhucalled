<template>
  <view class="container">
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text>‹</text>
      </view>
      <text class="title">我的发布</text>
      <view class="placeholder"></view>
    </view>
    
    <view class="tabs">
      <view 
        v-for="tab in tabs" 
        :key="tab.value"
        class="tab-item" 
        :class="{ active: activeTab === tab.value }"
        @click="handleTabChange(tab.value)"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>
    
    <scroll-view class="items-container" scroll-y>
      <view v-if="items.length === 0" class="empty-state">
        <text class="empty-icon">📦</text>
        <text class="empty-text">暂无发布记录</text>
      </view>
      
      <view v-else class="items-list">
        <view v-for="item in items" :key="item.id" class="item-card" @click="goDetail(item.id)">
          <image :src="item.images[0] || '/placeholder.png'" class="item-image" mode="aspectFill" />
          <view class="item-info">
            <view class="item-header">
              <span :class="['tag', `tag-${item.type}`]">{{ item.type === 'lost' ? '寻物' : '招领' }}</span>
              <text class="item-time">{{ format.formatTime(item.createdAt) }}</text>
            </view>
            <text class="item-title">{{ item.title }}</text>
            <text class="item-desc">{{ item.description }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { format } from '@/utils/format'

export default {
  data() {
    return {
      format,
      activeTab: 'all',
      status: 'active',
      items: [],
      tabs: [
        { value: 'all', label: '全部' },
        { value: 'lost', label: '寻物启事' },
        { value: 'found', label: '失物招领' }
      ]
    }
  },
  onLoad(options) {
    if (options?.type) {
      this.activeTab = options.type
    }
    if (options?.status) {
      this.status = options.status
    }
    this.loadItems()
  },
  methods: {
    goBack() {
      uni.navigateBack()
    },
    async handleTabChange(value) {
      this.activeTab = value
      this.items = []
      await this.loadItems()
    },
    async loadItems() {
      uni.showLoading({ title: '加载中...' })
      try {
        const res = await api.getUserItems({
          type: this.activeTab,
          status: this.status,
          page: 1,
          pageSize: 100
        })
        this.items = res.data || []
      } catch (err) {
        uni.showToast({ title: '加载失败', icon: 'none' })
      }
      uni.hideLoading()
    },
    goDetail(id) {
      uni.navigateTo({ url: `/pages/item/detail?id=${id}` })
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 60rpx 30rpx 20rpx;
  background: #ffffff;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: #333;
}

.title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.placeholder {
  width: 60rpx;
}

.tabs {
  display: flex;
  background: #ffffff;
  padding: 0 20rpx;
  border-bottom: 1rpx solid #eee;
}

.tab-item {
  flex: 1;
  padding: 25rpx;
  text-align: center;
  font-size: 28rpx;
  color: #999;
  position: relative;
}

.tab-item.active {
  color: #4f8cff;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 4rpx;
  background: #4f8cff;
  border-radius: 2rpx;
}

.items-container {
  height: calc(100vh - 180rpx);
  padding: 20rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.item-card {
  display: flex;
  background: #ffffff;
  border-radius: 15rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
}

.item-image {
  width: 200rpx;
  height: 200rpx;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 15rpx;
  margin-bottom: 10rpx;
}

.tag {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.tag-lost {
  background: #ffffff3e0;
  color: #ff9800;
}

.tag-found {
  background: #e3f2fd;
  color: #1976d2;
}

.item-time {
  font-size: 22rpx;
  color: #999;
}

.item-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.item-desc {
  font-size: 24rpx;
  color: #999;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>