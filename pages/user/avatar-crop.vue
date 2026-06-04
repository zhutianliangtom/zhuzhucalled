<template>
  <view class="container">
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text>‹</text>
      </view>
      <text class="header-title">裁剪头像</text>
      <view class="confirm-btn" @click="confirmCrop">
        <text>确定</text>
      </view>
    </view>
    
    <view class="crop-container">
      <!-- 背景图片 -->
      <image 
        class="bg-image" 
        :src="imageSrc" 
        :style="bgImageStyle"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        mode="aspectFit"
      />
      
      <!-- 遮罩层 -->
      <view class="mask">
        <!-- 顶部遮罩 -->
        <view class="mask-top" />
        <!-- 中间裁剪框区域 -->
        <view class="crop-area-wrapper">
          <view class="mask-left" />
          <!-- 裁剪框 -->
          <view class="crop-area">
            <!-- 四角装饰 -->
            <view class="corner corner-tl" />
            <view class="corner corner-tr" />
            <view class="corner corner-bl" />
            <view class="corner corner-br" />
            <!-- 网格线 -->
            <view class="grid-line grid-h grid-h1" />
            <view class="grid-line grid-h grid-h2" />
            <view class="grid-line grid-v grid-v1" />
            <view class="grid-line grid-v grid-v2" />
          </view>
          <view class="mask-right" />
        </view>
        <!-- 底部遮罩 -->
        <view class="mask-bottom" />
      </view>
    </view>
    
    <view class="tips">
      <text>双指缩放，单指拖动调整位置</text>
    </view>
    
    <canvas 
      canvas-id="cropCanvas" 
      class="crop-canvas"
      :style="{ width: cropSize + 'px', height: cropSize + 'px' }"
    />
  </view>
</template>

<script>
export default {
  data() {
    return {
      imageSrc: '',
      // 裁剪相关状态
      scale: 1,
      translateX: 0,
      translateY: 0,
      minScale: 1,
      // 触摸相关
      lastTouchDistance: 0,
      lastTranslateX: 0,
      lastTranslateY: 0,
      lastScale: 1,
      touchStartX: 0,
      touchStartY: 0,
      // 画布尺寸
      cropSize: 400,
      // 图片原始信息
      imageWidth: 0,
      imageHeight: 0
    }
  },
  computed: {
    bgImageStyle() {
      return {
        transform: `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`
      }
    }
  },
  onLoad(options) {
    if (options.imagePath) {
      this.imageSrc = options.imagePath
      // 获取图片信息
      uni.getImageInfo({
        src: options.imagePath,
        success: (res) => {
          this.imageWidth = res.width
          this.imageHeight = res.height
          this.initPosition()
        }
      })
    }
  },
  methods: {
    // 初始化图片位置，让图片居中填满裁剪框
    initPosition() {
      const systemInfo = uni.getSystemInfoSync()
      const screenWidth = systemInfo.windowWidth
      const cropAreaSize = screenWidth - 100 // 裁剪框大小（左右各50px边距）
      
      // 计算合适的初始缩放比例
      const scaleX = cropAreaSize / this.imageWidth
      const scaleY = cropAreaSize / this.imageHeight
      this.scale = Math.max(scaleX, scaleY)
      this.minScale = this.scale
      
      // 初始居中
      this.translateX = 0
      this.translateY = 0
    },
    
    // 触摸开始
    onTouchStart(e) {
      const touches = e.touches
      
      if (touches.length === 1) {
        // 单指拖动
        this.touchStartX = touches[0].clientX
        this.touchStartY = touches[0].clientY
        this.lastTranslateX = this.translateX
        this.lastTranslateY = this.translateY
      } else if (touches.length === 2) {
        // 双指缩放
        this.lastTouchDistance = this.getDistance(touches[0], touches[1])
        this.lastScale = this.scale
        
        // 计算双指中心点作为新的起始点
        this.touchStartX = (touches[0].clientX + touches[1].clientX) / 2
        this.touchStartY = (touches[0].clientY + touches[1].clientY) / 2
        this.lastTranslateX = this.translateX
        this.lastTranslateY = this.translateY
      }
    },
    
    // 触摸移动
    onTouchMove(e) {
      const touches = e.touches
      
      if (touches.length === 1) {
        // 单指拖动
        const deltaX = touches[0].clientX - this.touchStartX
        const deltaY = touches[0].clientY - this.touchStartY
        this.translateX = this.lastTranslateX + deltaX
        this.translateY = this.lastTranslateY + deltaY
      } else if (touches.length === 2) {
        // 双指缩放
        const currentDistance = this.getDistance(touches[0], touches[1])
        const scaleDelta = currentDistance / this.lastTouchDistance
        
        // 更新缩放
        let newScale = this.lastScale * scaleDelta
        newScale = Math.max(this.minScale, Math.max(0.5, Math.min(5, newScale)))
        
        // 计算缩放中心点的位移，保持中心点不变
        const scaleRatio = newScale / this.scale
        
        const centerX = (touches[0].clientX + touches[1].clientX) / 2
        const centerY = (touches[0].clientY + touches[1].clientY) / 2
        
        const deltaX = centerX - this.touchStartX
        const deltaY = centerY - this.touchStartY
        
        this.translateX = this.lastTranslateX + deltaX
        this.translateY = this.lastTranslateY + deltaY
        
        this.scale = newScale
      }
    },
    
    // 触摸结束
    onTouchEnd() {
      // 可以在这里添加边界修正
    },
    
    // 计算两点之间的距离
    getDistance(p1, p2) {
      const dx = p1.clientX - p2.clientX
      const dy = p1.clientY - p2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    },
    
    // 返回
    goBack() {
      uni.navigateBack()
    },
    
    // 确认裁剪
    async confirmCrop() {
      uni.showLoading({ title: '裁剪中...' })
      
      try {
        const systemInfo = uni.getSystemInfoSync()
        const screenWidth = systemInfo.windowWidth
        const cropAreaSize = screenWidth - 100 // 裁剪框大小
        
        // 获取图片信息
        const imageInfo = await new Promise((resolve, reject) => {
          uni.getImageInfo({
            src: this.imageSrc,
            success: resolve,
            fail: reject
          })
        })
        
        // 使用 Canvas 裁剪
        const ctx = uni.createCanvasContext('cropCanvas', this)
        const cropSize = this.cropSize
        
        // 清空画布
        ctx.clearRect(0, 0, cropSize, cropSize)
        
        // 计算绘制区域
        // 图片在屏幕上的显示尺寸
        const displayScale = Math.min(screenWidth / imageInfo.width, (screenWidth - 200) / imageInfo.height) * this.scale
        
        // 图片在屏幕上的实际显示大小
        const displayWidth = imageInfo.width * displayScale
        const displayHeight = imageInfo.height * displayScale
        
        // 计算裁剪框在画布上的对应位置
        const cropX = (cropAreaSize / 2 - displayWidth / 2 - this.translateX) / displayScale
        const cropY = (cropAreaSize / 2 - displayHeight / 2 - this.translateY) / displayScale
        const cropW = cropAreaSize / displayScale
        const cropH = cropAreaSize / displayScale
        
        // 绘制图片到画布
        ctx.drawImage(
          this.imageSrc,
          Math.max(0, cropX),
          Math.max(0, cropY),
          Math.min(cropW, imageInfo.width - Math.max(0, cropX)),
          Math.min(cropH, imageInfo.height - Math.max(0, cropY)),
          0,
          0,
          cropSize,
          cropSize
        )
        
        // 保存并导出
        ctx.draw(false, () => {
          uni.canvasToTempFilePath({
            canvasId: 'cropCanvas',
            width: cropSize,
            height: cropSize,
            destWidth: cropSize * 2,
            destHeight: cropSize * 2,
            fileType: 'jpg',
            quality: 0.9,
            success: (res) => {
              uni.hideLoading()
              
              // 返回结果到上一页
              const pages = getCurrentPages()
              const prevPage = pages[pages.length - 2]
              if (prevPage) {
                prevPage.$vm.handleCropResult(res.tempFilePath)
              }
              
              uni.navigateBack()
            },
            fail: () => {
              uni.hideLoading()
              // 如果裁剪失败，直接返回原图
              const pages = getCurrentPages()
              const prevPage = pages[pages.length - 2]
              if (prevPage) {
                prevPage.$vm.handleCropResult(this.imageSrc)
              }
              uni.navigateBack()
            }
          }, this)
        })
        
      } catch (err) {
        uni.hideLoading()
        uni.showToast({ title: '裁剪失败', icon: 'none' })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #000;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 60rpx 30rpx 30rpx;
  background: rgba(0, 0, 0, 0.8);
  z-index: 100;
}

.back-btn, .confirm-btn {
  width: 80rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn text {
  font-size: 48rpx;
  color: #fff;
}

.header-title {
  font-size: 34rpx;
  color: #fff;
  font-weight: bold;
}

.confirm-btn text {
  font-size: 30rpx;
  color: #2563eb;
  font-weight: bold;
}

.crop-container {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.bg-image {
  position: absolute;
  max-width: 100%;
  max-height: 100%;
  transform-origin: center center;
}

.mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
}

.mask-top, .mask-bottom {
  flex: 1;
  background: rgba(0, 0, 0, 0.7);
}

.crop-area-wrapper {
  display: flex;
}

.mask-left, .mask-right {
  flex: 1;
  background: rgba(0, 0, 0, 0.7);
}

.crop-area {
  width: calc(100vw - 100rpx);
  height: calc(100vw - 100rpx);
  position: relative;
  box-sizing: border-box;
}

/* 四角装饰 */
.corner {
  position: absolute;
  width: 40rpx;
  height: 40rpx;
  border: 6rpx solid #fff;
}

.corner-tl {
  top: -3rpx;
  left: -3rpx;
  border-right: none;
  border-bottom: none;
}

.corner-tr {
  top: -3rpx;
  right: -3rpx;
  border-left: none;
  border-bottom: none;
}

.corner-bl {
  bottom: -3rpx;
  left: -3rpx;
  border-right: none;
  border-top: none;
}

.corner-br {
  bottom: -3rpx;
  right: -3rpx;
  border-left: none;
  border-top: none;
}

/* 网格线 */
.grid-line {
  position: absolute;
  background: rgba(255, 255, 255, 0.3);
}

.grid-h {
  left: 0;
  right: 0;
  height: 1rpx;
}

.grid-h1 {
  top: 33.33%;
}

.grid-h2 {
  top: 66.66%;
}

.grid-v {
  top: 0;
  bottom: 0;
  width: 1rpx;
}

.grid-v1 {
  left: 33.33%;
}

.grid-v2 {
  left: 66.66%;
}

.tips {
  padding: 30rpx;
  text-align: center;
  background: rgba(0, 0, 0, 0.8);
}

.tips text {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.7);
}

.crop-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
}
</style>
