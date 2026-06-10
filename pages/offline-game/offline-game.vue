<template>
  <view class="game-container" :class="{ day: !isNight, night: isNight }" @click="handleClick">
    <view v-if="!gameStarted && !gameOver" class="start-screen">
      <text v-if="isOffline" class="network-error">:( 你与 Internet 断开，请检查防火墙配置或网络适配器，或者...</text>
      <view class="start-content">
        <image src="/uniapp_1145114/person.png" class="logo" mode="aspectFit" />
        <text class="start-title">跳跃游戏</text>
        <text class="start-hint">点击开始</text>
      </view>
    </view>

    <view v-if="gameStarted" class="game-area">
      <text class="score" :class="{ flashing: isScoreFlashing }">{{ score }}</text>
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

    <view v-if="gameStarted && gameOver" class="game-over">
      <text class="game-over-title">游戏结束</text>
      <text class="final-score">{{ score }}</text>
      <text v-if="score >= highScore && score > 0" class="new-record">新纪录!</text>
      <text class="restart-hint">点击重新开始</text>
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
      jumpVelocity: 0,
      jumpPosition: 0,
      sysWidth: 375,
      isOffline: true,
      isNight: false,
      lastModeChangeScore: 0,
      isScoreFlashing: false
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
          this.update()
          
          const now = Date.now()
          
          if (now - lastObstacleTime > this.getObstacleInterval()) {
            this.generateObstacle()
            lastObstacleTime = now
          }
          
          if (now - lastScoreTime > 100) {
            this.score++
            
            if (this.score % 50 === 0 && this.currentSpeed < 15) {
              this.currentSpeed += 0.3
            }
            
            // 每100分分数闪烁3秒
            if (this.score % 100 === 0) {
              this.isScoreFlashing = true
              setTimeout(() => {
                this.isScoreFlashing = false
              }, 3000)
            }
            
            // 每1000分切换一次黑夜/白天模式
            if (Math.floor(this.score / 1000) > this.lastModeChangeScore) {
              this.isNight = !this.isNight
              this.lastModeChangeScore = Math.floor(this.score / 1000)
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
      if (this.isJumping && this.dinoY > 0) {
        this.jumpVelocity += 8
        return
      }
      
      this.isJumping = true
      this.jumpVelocity = 22
      this.jumpPosition = 0

      if (this.jumpTimer) clearInterval(this.jumpTimer)
      
      this.jumpTimer = setInterval(() => {
        this.jumpVelocity -= 0.65
        this.jumpPosition += this.jumpVelocity
        
        if (this.jumpPosition <= 0) {
          this.jumpPosition = 0
          this.jumpVelocity = 0
          this.isJumping = false
          clearInterval(this.jumpTimer)
          this.jumpTimer = null
        }
        
        this.dinoY = this.jumpPosition
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
      } else if (type === 'bird') {
        width = 35
        height = 20
        // 飞鸟有40%概率降落到地面，60%概率在空中飞
        if (Math.random() < 0.4) {
          bottom = this.groundY
        } else {
          bottom = this.groundY + 60 + Math.random() * 40
        }
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
      this.lastModeChangeScore = 0
      this.isNight = false
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
  transition: background-color 1s ease;
}

.game-container.night {
  background: #1a1a2e;
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

.score.flashing {
  animation: scoreFlash 0.3s ease-in-out infinite;
}

@keyframes scoreFlash {
  0%, 100% { 
    opacity: 1; 
    transform: scale(1);
    color: #ff6b6b;
  }
  50% { 
    opacity: 0.5; 
    transform: scale(1.2);
    color: #ff8787;
  }
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
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.game-over-title {
  font-size: 36rpx;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.7);
}

.final-score {
  font-size: 72rpx;
  font-weight: 700;
  color: #333;
  margin-top: 20rpx;
}

.new-record {
  font-size: 28rpx;
  color: #ff6b6b;
  font-weight: 600;
  margin-top: 10rpx;
  animation: pulse 0.5s ease-in-out infinite;
}

.restart-hint {
  font-size: 26rpx;
  color: rgba(0, 0, 0, 0.5);
  margin-top: 30rpx;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

// 白天模式样式（浅色天空）
.day .game-container {
  background: linear-gradient(180deg, #87CEEB 0%, #E0F7FA 100%);
}

.day .ground {
  background: linear-gradient(180deg, #8BC34A 0%, #689F38 100%);
  border-top-color: #558B2F;
}

.day .score {
  color: #333;
}

.day .high-score {
  color: #666;
}

.day .start-screen {
  background: linear-gradient(180deg, #87CEEB 0%, #E0F7FA 100%);
}

.day .start-title {
  color: #333;
}

.day .start-hint {
  color: #666;
}

// 黑夜模式样式
.night .score {
  color: #fff;
}

.night .high-score {
  color: #ccc;
}

.night .start-screen {
  background: #1a1a2e;
}

.night .start-title {
  color: #fff;
}

.night .start-hint {
  color: #ccc;
}

.night .ground {
  background: #16213e;
  border-top-color: #0f3460;
}

.night .game-over-title {
  color: rgba(255, 255, 255, 0.9);
}

.night .final-score {
  color: #fff;
}

.night .restart-hint {
  color: rgba(255, 255, 255, 0.6);
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