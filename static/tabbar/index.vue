<template>
  <view 
    class="custom-tabbar"
    :class="{ 'glass-effect': glassEnabled }"
  >
    <view v-if="glassEnabled" class="glass-overlay"></view>
    <view class="tab-container">
      <view 
        v-for="(item, index) in tabs" 
        :key="index"
        class="tab-item"
        :class="{ active: currentIndex === index }"
        @touchstart="handleTouchStart($event, index)"
        @touchmove="handleTouchMove($event)"
        @touchend="handleTouchEnd"
        @click="handleClick(index)"
      >
        <view class="icon-wrapper">
          <image :src="currentIndex === index ? item.selectedIconPath : item.iconPath" class="tab-icon" />
        </view>
        <text class="tab-text">{{ item.text }}</text>
      </view>
      
      <view 
        class="liquid-indicator"
        :style="{ 
          left: indicatorLeft + 'px', 
          width: indicatorWidth + 'px',
          transform: `scale(${liquidScale})`
        }"
      ></view>
    </view>
  </view>
</template>

<script>
import { storage } from '@/utils/storage'

export default {
  data() {
    return {
      tabs: [
        { pagePath: '/pages/index/index', text: '首页', iconPath: '/static/tab/home.png', selectedIconPath: '/static/tab/home-active.png' },
        { pagePath: '/pages/message/index', text: '消息', iconPath: '/static/tab/message.png', selectedIconPath: '/static/tab/message-active.png' },
        { pagePath: '/pages/item/publish', text: '发布', iconPath: '/static/tab/publish.png', selectedIconPath: '/static/tab/publish-active.png' },
        { pagePath: '/pages/user/index', text: '我的', iconPath: '/static/tab/user.png', selectedIconPath: '/static/tab/user-active.png' }
      ],
      currentIndex: 0,
      indicatorLeft: 0,
      indicatorWidth: 0,
      liquidScale: 1,
      glassEnabled: true,
      isLongPress: false,
      longPressTimer: null,
      touchStartX: 0,
      touchStartY: 0,
      touchStartTime: 0,
      startIndex: 0,
      tabWidth: 0
    }
  },
  mounted() {
    this.loadSettings()
    this.updateIndicator()
    
    const pages = getCurrentPages()
    if (pages.length > 0) {
      const currentPage = pages[pages.length - 1]
      const pagePath = '/' + currentPage.route
      const index = this.tabs.findIndex(tab => tab.pagePath === pagePath)
      if (index !== -1) {
        this.currentIndex = index
        this.updateIndicator()
      }
    }
    
    this.$on('update', (index) => {
      this.currentIndex = index
      this.updateIndicator()
    })
  },
  methods: {
    loadSettings() {
      const settings = storage.getSettings() || {}
      this.glassEnabled = settings.glassEffect !== undefined ? settings.glassEffect : true
    },
    updateIndicator() {
      setTimeout(() => {
        const systemInfo = uni.getSystemInfoSync()
        const screenWidth = systemInfo.windowWidth
        this.tabWidth = screenWidth / this.tabs.length
        this.indicatorLeft = this.currentIndex * this.tabWidth + (this.tabWidth - 60) / 2
        this.indicatorWidth = 60
      }, 100)
    },
    handleTouchStart(e, index) {
      this.touchStartX = e.touches[0].clientX
      this.touchStartY = e.touches[0].clientY
      this.touchStartTime = Date.now()
      this.startIndex = index
      this.isLongPress = false
      
      this.longPressTimer = setTimeout(() => {
        this.isLongPress = true
        this.liquidScale = 1.5
        uni.vibrateShort({})
      }, 500)
    },
    handleTouchMove(e) {
      if (!this.isLongPress) return
      
      const deltaX = e.touches[0].clientX - this.touchStartX
      const moveIndex = Math.round((deltaX / this.tabWidth) + this.startIndex)
      const clampedIndex = Math.max(0, Math.min(moveIndex, this.tabs.length - 1))
      
      this.liquidScale = 1.2 + Math.abs(deltaX) / 100
      
      if (clampedIndex !== this.currentIndex) {
        this.liquidScale = 1.8
      }
      
      this.indicatorLeft = clampedIndex * this.tabWidth + (this.tabWidth - 60) / 2 + (deltaX - (clampedIndex - this.startIndex) * this.tabWidth) * 0.5
    },
    handleTouchEnd() {
      clearTimeout(this.longPressTimer)
      
      if (this.isLongPress) {
        const systemInfo = uni.getSystemInfoSync()
        const screenWidth = systemInfo.windowWidth
        const tabWidth = screenWidth / this.tabs.length
        
        let targetIndex = Math.round(this.indicatorLeft / tabWidth)
        targetIndex = Math.max(0, Math.min(targetIndex, this.tabs.length - 1))
        
        this.liquidScale = 1
        
        setTimeout(() => {
          if (targetIndex !== this.currentIndex) {
            this.currentIndex = targetIndex
            this.switchPage(targetIndex)
          }
          this.updateIndicator()
        }, 100)
      }
    },
    handleClick(index) {
      if (!this.isLongPress && index !== this.currentIndex) {
        this.currentIndex = index
        this.updateIndicator()
        this.switchPage(index)
      }
    },
    switchPage(index) {
      const tab = this.tabs[index]
      uni.switchTab({ url: tab.pagePath })
    }
  },
  watch: {
    currentIndex() {
      this.updateIndicator()
    },
    glassEnabled(val) {
      const settings = storage.getSettings() || {}
      settings.glassEffect = val
      storage.setSettings(settings)
    }
  }
}
</script>

<style lang="scss" scoped>
.custom-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 999;
  padding: 20rpx 0;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.95);
  border-top: 1rpx solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.custom-tabbar.glass-effect {
  background: transparent;
  border-top: none;
}

.glass-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(245, 245, 250, 0.85);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  -moz-backdrop-filter: blur(20px);
  -ms-backdrop-filter: blur(20px);
  border-top: 1rpx solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 -8rpx 32rpx rgba(102, 126, 234, 0.18),
              0 -4rpx 16rpx rgba(0, 0, 0, 0.08),
              inset 0 2rpx 0 rgba(255, 255, 255, 0.95);
  background-image: 
    linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 50%, rgba(248,248,250,0.8) 100%),
    radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.5) 0%, transparent 70%);
  border-radius: 24rpx 24rpx 0 0;
  z-index: 0;
}

.glass-overlay::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  pointer-events: none;
}

.tab-container {
  position: relative;
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 80rpx;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;
}

.icon-wrapper {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4rpx;
  transition: all 0.3s ease;
}

.tab-item.active .icon-wrapper {
  transform: scale(1.1);
}

.tab-icon {
  width: 44rpx;
  height: 44rpx;
}

.tab-text {
  font-size: 22rpx;
  color: #999;
  transition: all 0.3s ease;
}

.tab-item.active .tab-text {
  color: #334155;
  font-weight: 500;
}

.liquid-indicator {
  position: absolute;
  height: 60rpx;
  border-radius: 30rpx;
  background: #334155;
  transition: left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.3s ease;
  opacity: 0.8;
  box-shadow: 0 8rpx 25rpx rgba(51, 65, 85, 0.4);
  will-change: left, transform;
  transform-origin: center center;
}

.liquid-indicator::before,
.liquid-indicator::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 10rpx;
  height: 10rpx;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  transform: translateY(-50%);
  animation: bubble 2s infinite;
}

.liquid-indicator::before {
  left: 15rpx;
  animation-delay: 0s;
}

.liquid-indicator::after {
  right: 15rpx;
  animation-delay: 1s;
}

@keyframes bubble {
  0%, 100% {
    transform: translateY(-50%) scale(1);
    opacity: 0.5;
  }
  50% {
    transform: translateY(-50%) scale(1.3);
    opacity: 1;
  }
}
</style>