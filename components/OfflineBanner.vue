<template>
  <view v-if="showOfflineBanner" class="offline-banner">
    <text class="offline-icon">⚠️</text>
    <text class="offline-text">无法连接服务器</text>
  </view>
</template>

<script>
export default {
  name: 'OfflineBanner',
  data() {
    return {
      showOfflineBanner: false
    }
  },
  mounted() {
    // 监听网络状态变化事件
    uni.$on('network-status-change', this.handleNetworkChange)
  },
  beforeDestroy() {
    // 移除事件监听
    uni.$off('network-status-change', this.handleNetworkChange)
  },
  methods: {
    handleNetworkChange(data) {
      this.showOfflineBanner = !data.isOnline
    }
  }
}
</script>

<style scoped>
.offline-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #ff4757;
  color: #fff;
  padding: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.2);
}

.offline-icon {
  font-size: 28rpx;
  margin-right: 10rpx;
}

.offline-text {
  font-size: 26rpx;
  font-weight: bold;
}
</style>
