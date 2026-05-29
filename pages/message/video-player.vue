<template>
  <view class="container">
    <view class="video-container">
      <video 
        :src="videoUrl" 
        autoplay 
        controls 
        class="video-player"
        @error="onVideoError"
      />
    </view>
    <view class="close-btn" @click="close">
      <text>✕</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      videoUrl: ''
    }
  },
  onLoad(options) {
    if (options?.url) {
      this.videoUrl = decodeURIComponent(options.url)
    }
  },
  methods: {
    close() {
      uni.navigateBack()
    },
    onVideoError(err) {
      uni.showToast({ title: '视频播放失败', icon: 'none' })
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.video-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-player {
  width: 100%;
  height: 100vh;
}

.close-btn {
  position: absolute;
  top: 40rpx;
  right: 30rpx;
  width: 70rpx;
  height: 70rpx;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn text {
  color: #fff;
  font-size: 32rpx;
}
</style>