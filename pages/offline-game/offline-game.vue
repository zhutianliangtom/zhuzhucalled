<template>
  <view class="game-container" @click="handleClick">
    <view v-if="!gameStarted && !gameOver" class="start-screen">
      <text v-if="isOffline" class="network-error">:( 你与 Internet 断开，请检查防火墙配置或网络适配器，或者...</text>
      <view class="start-content">
        <image src="/uniapp_1145114/person.png" class="logo" mode="aspectFit" />
        <text class="start-title">跳跃游戏</text>
        <text class="start-hint">点击开始</text>
      </view>
    </view>

    <view v-if="gameStarted && !gameOver" class="game-area">
      <text class="score">{{ score }}</text>
      <text class="high-score">最高分: {{ highScore }}</text>
      
      <view class="dino" :style="{ bottom: (groundY + dinoY) + 'px' }">
        <image src="/uniapp_1145114/person.png" class="dino-img" mode="aspectFit" />
      </view>
      
      <view 
        v-for="obstacle in obstacles" 
        :key="obstacle.id"
        class="obstacle"
        :class="obstacle.type"
        :style="{ left: obstacle.x + 'px', height: obstacle.height + 'px', width: obstacle.width + 'px', bottom: obstacle.bottom + 'px' }"
      >
        <text v-if="obstacle.type === 'bird'" class="bird-emoji">🐦</text>
      </view>
      
      <view class="ground"></view>
    </view>

    <view v-if="gameOver" class="game-over">
      <view class="game-over-content">
        <text class="game-over-title">游戏结束</text>
        <text class="final-score">{{ score }}</text>
        <text v-if="score >= highScore && score > 0" class="new-record">新纪录!</text>
        <text class="restart-hint">点击重新开始</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      gameStarted: false,
      gameOver: false,
      score: 0,
      highScore: 0,
      isJumping: false,
      obstacles: [],
      gameLoop: null,
      baseSpeed: 5,
      currentSpeed: 5,
      groundY: 24,
      gameAreaWidth: 375,
      dinoY: 0,
      jumpTimer: null,
      sysWidth: 375,
      isOffline: true
    }
  },
  onLoad(options) {
    const systemInfo = uni.getSystemInfoSync()
    this.sysWidth = systemInfo.windowWidth
    this.gameAreaWidth = this.sysWidth
    
    try {
      const saved = uni.getStorageSync('dino_high_score')
      this.highScore = saved ? parseInt(saved) || 0 : 0
    } catch (e) {
      this.highScore = 0
    }
    
    uni.getNetworkType({
      success: (res) => {
        this.isOffline = res.networkType === 'none'
      },
      fail: () => {
        this.isOffline = true
      }
    })
    
    uni.onNetworkStatusChange((res) => {
      this.isOffline = !res.isConnected
    })
  },
  onUnload() {
    this.stopGame()
  },
  onHide() {
    this.stopGame()
  },
  methods: {
    handleClick() {
      if (this.gameOver) {
        this.restartGame()
      } else if (!this.gameStarted) {
        this.startGame()
      } else {
        this.jump()
      }
    },

    startGame() {
      this.stopGame()
      
      this.gameStarted = true
      this.gameOver = false
      this.score = 0
      this.obstacles = []
      this.currentSpeed = this.baseSpeed
      this.dinoY = 0

      let lastObstacleTime = Date.now()
      let lastScoreTime = Date.now()
      
      this.gameLoop = setInterval(() => {
        if (!this.gameOver) {
          const now = Date.now()
          
          this.update()
          
          if (now - lastObstacleTime > this.getObstacleInterval()) {
            this.generateObstacle()
            lastObstacleTime = now
          }
          
          if (now - lastScoreTime > 100) {
            this.score++
            
            if (this.score % 30 === 0 && this.currentSpeed < 15) {
              this.currentSpeed += 0.3
            }
            
            lastScoreTime = now
          }
        }
      }, 30)
    },

    getObstacleInterval() {
      const baseInterval = 1800
      const minInterval = 800
      const speedFactor = this.currentSpeed / this.baseSpeed
      return Math.max(minInterval, baseInterval / speedFactor)
    },

    stopGame() {
      if (this.gameLoop) {
        clearInterval(this.gameLoop)
        this.gameLoop = null
      }
      if (this.jumpTimer) {
        clearInterval(this.jumpTimer)
        this.jumpTimer = null
      }
      this.isJumping = false
    },

    jump() {
      if (this.isJumping) return
      
      this.isJumping = true
      let velocity = 18
      let position = 0

      if (this.jumpTimer) clearInterval(this.jumpTimer)
      
      this.jumpTimer = setInterval(() => {
        velocity -= 0.75
        position += velocity
        
        if (position <= 0) {
          position = 0
          this.isJumping = false
          clearInterval(this.jumpTimer)
          this.jumpTimer = null
        }
        
        this.dinoY = position
      }, 16)
    },

    update() {
      this.obstacles = this.obstacles.filter(obstacle => {
        obstacle.x -= this.currentSpeed
        return obstacle.x > -60
      })

      this.checkCollision()
    },

    generateObstacle() {
      const types = ['cactus']
      
      if (this.score >= 200) {
        types.push('bird')
      }
      
      const type = types[Math.floor(Math.random() * types.length)]
      
      let height, width, bottom
      
      if (type === 'cactus') {
        width = 25
        height = 40 + Math.random() * 25
        bottom = this.groundY
      } else {
        width = 35
        height = 20
        bottom = this.groundY + 60 + Math.random() * 40
      }
      
      this.obstacles.push({
        id: Date.now() + Math.random(),
        type: type,
        x: this.gameAreaWidth + 30,
        height: height,
        width: width,
        bottom: bottom
      })
    },

    checkCollision() {
      const dinoLeft = 30
      const dinoRight = 30 + 50
      const dinoBottom = this.groundY + this.dinoY
      const dinoTop = dinoBottom + 60

      for (let obstacle of this.obstacles) {
        const obsLeft = obstacle.x + 5
        const obsRight = obstacle.x + obstacle.width - 5
        const obsBottom = obstacle.bottom || this.groundY
        const obsTop = obsBottom + obstacle.height

        if (dinoRight > obsLeft && dinoLeft < obsRight && 
            dinoTop > obsBottom && dinoBottom < obsTop) {
          this.endGame()
          return
        }
      }
    },

    endGame() {
      this.gameOver = true
      this.stopGame()
      
      if (this.score > this.highScore) {
        this.highScore = this.score
        try {
          uni.setStorageSync('dino_high_score', this.score.toString())
        } catch (e) {}
      }
    },

    restartGame() {
      this.stopGame()
      
      this.gameStarted = false
      this.gameOver = false
      this.score = 0
      this.obstacles = []
      this.currentSpeed = this.baseSpeed
      this.dinoY = 0
      this.isJumping = false
    }
  }
}
</script>

<style lang="scss" scoped>
.game-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fafafa;
  overflow: hidden;
  z-index: 9999;
  user-select: none;
}

.start-screen {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}

.network-error {
  position: absolute;
  top: 30rpx;
  left: 30rpx;
  right: 30rpx;
  font-size: 112rpx;
  color: #666;
  line-height: 1.6;
  background: transparent;
  max-height: 45%;
  overflow: hidden;
}

.start-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40rpx;
}

.logo {
  width: 160rpx;
  height: 160rpx;
}

.start-title {
  font-size: 36rpx;
  font-weight: 500;
  color: #333;
}

.start-hint {
  font-size: 24rpx;
  color: #999;
}

.game-area {
  position: relative;
  width: 100%;
  height: 100%;
  background: #fff;
}

.score {
  position: absolute;
  top: 40rpx;
  right: 30rpx;
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}

.high-score {
  position: absolute;
  top: 40rpx;
  left: 30rpx;
  font-size: 22rpx;
  color: #999;
}

.dino {
  position: absolute;
  left: 30px;
  width: 50px;
  height: 60px;
}

.dino-img {
  width: 100%;
  height: 100%;
}

.obstacle {
  position: absolute;
  
  &.cactus {
    background: #4a7c23;
  }
  
  &.bird {
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.bird-emoji {
  font-size: 28px;
  animation: birdFloat 0.8s ease-in-out infinite;
}

@keyframes birdFloat {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

.ground {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 24px;
  background: #fff;
  border-top: 2px solid #ccc;
}

.game-over {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
}

.game-over-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  padding: 40rpx 60rpx;
  background: #fff;
  border-radius: 16rpx;
}

.game-over-title {
  font-size: 32rpx;
  font-weight: 500;
  color: #333;
}

.final-score {
  font-size: 56rpx;
  font-weight: 600;
  color: #333;
}

.new-record {
  font-size: 24rpx;
  color: #ff6b6b;
  font-weight: 500;
}

.restart-hint {
  font-size: 24rpx;
  color: #999;
}
</style>