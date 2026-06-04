<template>
  <view class="container">
    <view class="header">
      <text class="header-title">我的收藏</text>
      <view class="back-btn" @click="goBack">
        <text>‹</text>
      </view>
    </view>
    
    <view v-if="collections.length === 0" class="empty-state">
      <text class="empty-icon">❤️</text>
      <text class="empty-text">暂无收藏</text>
      <text class="empty-desc">收藏喜欢的物品，方便随时查看</text>
    </view>
    
    <view v-else class="collection-list">
      <view v-for="item in collections" :key="item.id" class="collection-item" @click="goDetail(item.id)">
        <image v-if="item.images?.[0]" :src="item.images[0]" class="item-image" />
        <view v-else class="item-placeholder">
          <text class="placeholder-icon">📦</text>
        </view>
        <view class="item-info">
          <text class="item-title">{{ item.title }}</text>
          <text class="item-desc">{{ item.description }}</text>
          <view class="item-meta">
            <text :class="['item-tag', item.type === 'lost' ? 'lost' : 'found']">
              {{ item.type === 'lost' ? '寻物' : '招领' }}
            </text>
            <text class="item-time">{{ format.formatTime(item.createdAt) }}</text>
          </view>
        </view>
        <view class="remove-btn" @click.stop="removeCollection(item.id)">
          <text>×</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { format } from '@/utils/format'

export default {
  data() {
    return {
      collections: []
    }
  },
  onLoad() {
    this.loadCollections()
  },
  methods: {
    loadCollections() {
      this.collections = []
    },
    goBack() {
      uni.navigateBack()
    },
    goDetail(id) {
      uni.navigateTo({ url: `/pages/item/detail?id=${id}` })
    },
    removeCollection(id) {
      uni.showModal({
        title: '取消收藏',
        content: '确定取消收藏这个物品吗？',
        success: (res) => {
          if (res.confirm) {
            this.collections = this.collections.filter(item => item.id !== id)
            uni.showToast({ title: '取消成功', icon: 'success' })
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 30rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #333;
  margin-bottom: 15rpx;
}

.empty-desc {
  font-size: 26rpx;
  color: #999;
}

.collection-list {
  padding: 20rpx;
}

.collection-item {
  display: flex;
  align-items: center;
  background: #ffffff;
  border-radius: 15rpx;
  padding: 25rpx;
  margin-bottom: 20rpx;
  position: relative;
}

.item-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: 10rpx;
  object-fit: cover;
}

.item-placeholder {
  width: 160rpx;
  height: 160rpx;
  background: #f8f9fa;
  border-radius: 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 48rpx;
}

.item-info {
  flex: 1;
  margin-left: 20rpx;
  overflow: hidden;
}

.item-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 10rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-desc {
  font-size: 24rpx;
  color: #999;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 12rpx;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 15rpx;
}

.item-tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
}

.item-tag.lost {
  background: #ffffff3e0;
  color: #ff9800;
}

.item-tag.found {
  background: #e8f5e9;
  color: #4caf50;
}

.item-time {
  font-size: 22rpx;
  color: #bbb;
}

.remove-btn {
  width: 50rpx;
  height: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border-radius: 50%;
  margin-left: 15rpx;
}

.remove-btn text {
  font-size: 32rpx;
  color: #999;
}
</style>