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

    <view class="crop-area" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @wheel="onWheel">
      <!-- 使用flexbox居中的包装容器 -->
      <view class="crop-center-wrapper">
        <!-- 图片 -->
        <image
          v-if="imageSrc"
          class="crop-image"
          :src="imageSrc"
          :style="imageStyle"
          mode="scaleToFill"
        />
        
        <!-- 裁剪框 -->
        <view class="frame">
          <view class="corner corner-tl" />
          <view class="corner corner-tr" />
          <view class="corner corner-bl" />
          <view class="corner corner-br" />
          <view class="grid grid-h1" />
          <view class="grid grid-h2" />
          <view class="grid grid-v1" />
          <view class="grid grid-v2" />
        </view>
      </view>
    </view>

    <view class="tips">
      <text>双指缩放，单指拖动，滚轮缩放</text>
    </view>

    <canvas canvas-id="cropCanvas" class="hidden-canvas" />
  </view>
</template>

<script>
export default {
  data() {
    return {
      imageSrc: '',
      scale: 1,
      translateX: 0,
      translateY: 0,
      minScale: 1,
      lastTouchDistance: 0,
      lastTranslateX: 0,
      lastTranslateY: 0,
      lastScale: 1,
      touchStartX: 0,
      touchStartY: 0,
      imageWidth: 0,
      imageHeight: 0,
      screenWidth: 375,
      screenHeight: 667,
      frameSize: 280,
      // 初始偏移量，用于居中
      baseTranslateX: 0,
      baseTranslateY: 0
    }
  },
  computed: {
    imageStyle() {
      // 计算图片在裁剪框内的实际显示尺寸
      // 使用 aspectFit 模式，确保图片完整显示
      const displayScale = this.frameSize / Math.max(this.imageWidth, this.imageHeight)
      const displayWidth = this.imageWidth * displayScale
      const displayHeight = this.imageHeight * displayScale
      
      return {
        width: displayWidth + 'px',
        height: displayHeight + 'px',
        marginLeft: -displayWidth / 2 + 'px',
        marginTop: -displayHeight / 2 + 'px',
        transform: `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`,
        transformOrigin: 'center center'
      }
    }
  },
  onLoad(options) {
    console.log('=== 裁剪页面 onLoad ===')
    console.log('裁剪页面接收到的参数:', options)
    
    // 优先从全局变量获取图片路径
    const app = getApp()
    console.log('全局变量 cropImagePath:', app.globalData?.cropImagePath)
    
    if (app.globalData && app.globalData.cropImagePath) {
      this.imageSrc = app.globalData.cropImagePath
      console.log('从全局变量获取图片路径:', this.imageSrc)
      // 清除全局变量，避免重复使用
      app.globalData.cropImagePath = null
    } else if (options && options.src) {
      this.imageSrc = options.src
      console.log('从URL参数获取图片路径:', this.imageSrc)
    } else if (options && options.imagePath) {
      this.imageSrc = options.imagePath
      console.log('从imagePath参数获取图片路径:', this.imageSrc)
    }

    console.log('最终图片路径:', this.imageSrc)

    const sysInfo = uni.getSystemInfoSync()
    this.screenWidth = sysInfo.windowWidth
    this.screenHeight = sysInfo.windowHeight
    this.frameSize = (600 / 750) * this.screenWidth

    if (this.imageSrc) {
      uni.getImageInfo({
        src: this.imageSrc,
        success: (res) => {
          console.log('图片信息获取成功:', res)
          this.imageWidth = res.width
          this.imageHeight = res.height
          this.initScale()
        },
        fail: (err) => {
          console.error('获取图片信息失败:', err)
          uni.showToast({ title: '图片加载失败', icon: 'none' })
        }
      })
    } else {
      console.error('没有接收到图片路径')
      uni.showToast({ 
        title: '图片路径错误', 
        icon: 'none',
        duration: 2000
      })
      // 不要立即返回，让用户看到错误提示
      setTimeout(() => {
        uni.navigateBack()
      }, 2000)
    }
  },
  methods: {
    initScale() {
      // 计算图片在裁剪框内的基础显示尺寸
      // 使用 aspectFit 模式，确保图片完整显示在裁剪框内
      const displayScale = this.frameSize / Math.max(this.imageWidth, this.imageHeight)
      const displayWidth = this.imageWidth * displayScale
      const displayHeight = this.imageHeight * displayScale
      
      // 初始缩放为1，图片刚好完整显示在裁剪框内
      this.scale = 1
      
      // 最小缩放：允许缩小到0.5倍
      this.minScale = 0.5
      
      // translate 初始为0，图片居中
      this.translateX = 0
      this.translateY = 0
      
      console.log('initScale:', {
        frameSize: this.frameSize,
        imageWidth: this.imageWidth,
        imageHeight: this.imageHeight,
        displayScale,
        displayWidth,
        displayHeight,
        scale: this.scale,
        minScale: this.minScale
      })
    },
    onTouchStart(e) {
      const touches = e.touches

      if (touches.length === 1) {
        this.touchStartX = touches[0].clientX
        this.touchStartY = touches[0].clientY
        this.lastTranslateX = this.translateX
        this.lastTranslateY = this.translateY
      } else if (touches.length === 2) {
        this.lastTouchDistance = this.getDistance(touches[0], touches[1])
        this.lastScale = this.scale
        this.lastTranslateX = this.translateX
        this.lastTranslateY = this.translateY
        this.touchStartX = (touches[0].clientX + touches[1].clientX) / 2
        this.touchStartY = (touches[0].clientY + touches[1].clientY) / 2
      }
    },
    onTouchMove(e) {
      const touches = e.touches

      if (touches.length === 1) {
        const deltaX = touches[0].clientX - this.touchStartX
        const deltaY = touches[0].clientY - this.touchStartY
        this.translateX = this.lastTranslateX + deltaX
        this.translateY = this.lastTranslateY + deltaY
      } else if (touches.length === 2) {
        const currentDistance = this.getDistance(touches[0], touches[1])
        const scaleDelta = currentDistance / this.lastTouchDistance
        let newScale = this.lastScale * scaleDelta
        newScale = Math.max(this.minScale, Math.min(5, newScale))

        const centerX = (touches[0].clientX + touches[1].clientX) / 2
        const centerY = (touches[0].clientY + touches[1].clientY) / 2

        const deltaX = centerX - this.touchStartX
        const deltaY = centerY - this.touchStartY

        this.translateX = this.lastTranslateX + deltaX
        this.translateY = this.lastTranslateY + deltaY
        this.scale = newScale
      }
    },
    onTouchEnd() {},
    onWheel(e) {
      // 鼠标滚轮缩放 - 处理不同平台的事件格式
      const delta = e.deltaY !== undefined ? e.deltaY : (e.detail && e.detail.deltaY !== undefined ? e.detail.deltaY : 0)
      const zoomFactor = delta > 0 ? 0.9 : 1.1
      
      let newScale = this.scale * zoomFactor
      newScale = Math.max(this.minScale, Math.min(5, newScale))
      
      this.scale = newScale
    },
    getDistance(p1, p2) {
      const dx = p1.clientX - p2.clientX
      const dy = p1.clientY - p2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    },
    goBack() {
      uni.navigateBack()
    },
    async confirmCrop() {
      uni.showLoading({ title: '裁剪中...' })

      try {
        const imageInfo = await new Promise((resolve, reject) => {
          uni.getImageInfo({
            src: this.imageSrc,
            success: resolve,
            fail: reject
          })
        })

        const outputSize = 400

        // 计算图片在裁剪框内的基础显示尺寸（aspectFit 模式）
        const displayScale = this.frameSize / Math.max(this.imageWidth, this.imageHeight)
        const displayWidth = this.imageWidth * displayScale
        const displayHeight = this.imageHeight * displayScale

        // 计算裁剪框相对于图片的位置
        // 裁剪框是 600rpx × 600rpx，图片居中显示
        // translateX/translateY 是图片中心相对于裁剪框中心的偏移
        // scale 是图片的缩放比例

        // 计算缩放后的图片尺寸
        const scaledWidth = displayWidth * this.scale
        const scaledHeight = displayHeight * this.scale

        // 计算图片左上角相对于裁剪框左上角的位置
        // 图片居中，所以初始位置是 (frameSize - scaledWidth) / 2
        const imgLeft = (this.frameSize - scaledWidth) / 2 + this.translateX
        const imgTop = (this.frameSize - scaledHeight) / 2 + this.translateY

        // 计算裁剪区域在图片上的位置（相对于图片左上角）
        const cropLeft = -imgLeft
        const cropTop = -imgTop

        // 将裁剪区域映射到原图坐标
        const srcX = (cropLeft / scaledWidth) * this.imageWidth
        const srcY = (cropTop / scaledHeight) * this.imageHeight
        const srcWidth = (this.frameSize / scaledWidth) * this.imageWidth
        const srcHeight = (this.frameSize / scaledHeight) * this.imageHeight

        console.log('裁剪参数:', {
          displayScale, displayWidth, displayHeight,
          scaledWidth, scaledHeight,
          imgLeft, imgTop,
          cropLeft, cropTop,
          srcX, srcY, srcWidth, srcHeight
        })

        const ctx = uni.createCanvasContext('cropCanvas', this)

        ctx.clearRect(0, 0, outputSize, outputSize)

        // 绘制裁剪区域到 canvas
        ctx.drawImage(
          this.imageSrc,
          srcX, srcY, srcWidth, srcHeight,
          0, 0, outputSize, outputSize
        )

        ctx.draw(false, () => {
          uni.canvasToTempFilePath({
            canvasId: 'cropCanvas',
            width: outputSize,
            height: outputSize,
            destWidth: outputSize * 2,
            destHeight: outputSize * 2,
            fileType: 'jpg',
            quality: 0.9,
            success: (res) => {
              uni.hideLoading()

              const pages = getCurrentPages()
              const prevPage = pages[pages.length - 2]
              if (prevPage && typeof prevPage.handleCropResult === 'function') {
                prevPage.handleCropResult(res.tempFilePath)
              } else if (prevPage && prevPage.$vm && typeof prevPage.$vm.handleCropResult === 'function') {
                prevPage.$vm.handleCropResult(res.tempFilePath)
              }

              uni.navigateBack()
            },
            fail: (err) => {
              console.error('canvasToTempFilePath 失败:', err)
              uni.hideLoading()
              const pages = getCurrentPages()
              const prevPage = pages[pages.length - 2]
              if (prevPage && typeof prevPage.handleCropResult === 'function') {
                prevPage.handleCropResult(this.imageSrc)
              } else if (prevPage && prevPage.$vm && typeof prevPage.$vm.handleCropResult === 'function') {
                prevPage.$vm.handleCropResult(this.imageSrc)
              }
              uni.navigateBack()
            }
          }, this)
        })

      } catch (err) {
        console.error('Crop error:', err)
        uni.hideLoading()
        uni.showToast({ title: '裁剪失败', icon: 'none' })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  width: 100vw;
  height: 100vh;
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
  color: #334155;
  font-weight: bold;
}

.crop-area {
  flex: 1;
  position: relative;
  width: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
}

.crop-center-wrapper {
  position: relative;
  width: 600rpx;
  height: 600rpx;
}

.crop-image {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center center;
  z-index: 1;
}

.frame {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 2rpx solid rgba(255, 255, 255, 0.8);
  pointer-events: none;
  z-index: 10;
  /* 裁剪框区域透明，显示背景 */
  background: transparent;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
}

.corner {
  position: absolute;
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid #fff;
}

.corner-tl {
  top: -2rpx;
  left: -2rpx;
  border-right: none;
  border-bottom: none;
}

.corner-tr {
  top: -2rpx;
  right: -2rpx;
  border-left: none;
  border-bottom: none;
}

.corner-bl {
  bottom: -2rpx;
  left: -2rpx;
  border-right: none;
  border-top: none;
}

.corner-br {
  bottom: -2rpx;
  right: -2rpx;
  border-left: none;
  border-top: none;
}

.grid {
  position: absolute;
  background: rgba(255, 255, 255, 0.3);
}

.grid-h1, .grid-h2 {
  left: 0;
  right: 0;
  height: 1rpx;
}

.grid-h1 { top: 33.33%; }
.grid-h2 { top: 66.66%; }

.grid-v1, .grid-v2 {
  top: 0;
  bottom: 0;
  width: 1rpx;
}

.grid-v1 { left: 33.33%; }
.grid-v2 { left: 66.66%; }

.tips {
  padding: 30rpx;
  text-align: center;
  background: rgba(0, 0, 0, 0.8);
}

.tips text {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.7);
}

.hidden-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
  width: 400px;
  height: 400px;
}
</style>
