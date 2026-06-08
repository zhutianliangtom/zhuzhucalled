<template>
  <view class="game-container" @click="handleClick">
    <view v-if="!gameStarted && !gameOver" class="start-screen">
      <view class="start-content">
        <text v-if="!fromSettings" class="network-error">网络错误，来玩玩游戏吧</text>
        <view class="logo-wrapper">
          <image src="/uniapp_1145114/person.png" class="logo" mode="aspectFit" />
        </view>
        <text class="start-title">跳跃游戏</text>
        <text class="start-hint">点击屏幕开始</text>
      </view>
    </view>

    <view v-if="gameStarted && !gameOver" class="game-area">
      <view class="score-panel">
        <text class="score-value">{{ score }}</text>
      </view>

      <view class="high-score">
        <text>{{ highScore }}</text>
      </view>

      <view class="dino" :style="{ bottom: (groundY + dinoY) + 'px' }">
        <image src="/uniapp_1145114/person.png" class="dino-img" mode="aspectFit" />
      </view>

      <view 
        v-for="obstacle in obstacles" 
        :key="obstacle.id"
        class="obstacle"
        :class="obstacle.type"
        :style="{ left: obstacle.x + 'px', height: obstacle.height + 'px', width: obstacle.width + 'px', bottom: obstacle.bottom + 'px' }"
      ></view>

      <view class="ground"></view>
    </view>

    <view v-if="gameOver" class="game-over">
      <view class="game-over-content">
        <text class="game-over-title">游戏结束</text>
        <text class="final-score-value">{{ score }}</text>
        <view v-if="score >= highScore && score > 0" class="new-record">
          <text>新纪录!</text>
        </view>
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
      baseSpeed: 6,
      currentSpeed: 6,
      groundY: 30,
      gameAreaWidth: 375,
      dinoY: 0,
      fromSettings: false,
      obstacleTimer: null,
      scoreTimer: null,
      jumpTimer: null,
      sysWidth: 375,
      obstacleIdCounter: 0,
      availableObstacles: ['cactus']
    }
  },
  onLoad(options) {
    if (options && options.fromSettings === 'true') {
      this.fromSettings = true
    }
    
    const systemInfo = uni.getSystemInfoSync()
    this.sysWidth = systemInfo.windowWidth
    this.gameAreaWidth = this.sysWidth
    
    try {
      const saved = uni.getStorageSync('dino_high_score')
      if (saved) {
        try {
          this.highScore = parseInt(saved) || 0
        } catch (e) {
          this.highScore = 0
        }
      }
    } catch (e) {
      this.highScore = 0
    }
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
      this.availableObstacles = ['cactus']

      let lastTime = Date.now()
      let lastObstacleTime = Date.now()
      let lastScoreTime = Date.now()
      
      this.gameLoop = setInterval(() => {
        if (!this.gameOver) {
          const now = Date.now()
          
          this.update()
          
          if (now - lastObstacleTime > 1500) {
            this.generateObstacle()
            lastObstacleTime = now
          }
          
          if (now - lastScoreTime > 100) {
            this.score++
            if (this.score % 30 === 0 && this.currentSpeed < 15) {
              this.currentSpeed += 0.5
            }
            lastScoreTime = now
          }
          
          lastTime = now
        }
      }, 50)
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
      let velocity = 22
      let position = 0

      if (this.jumpTimer) clearInterval(this.jumpTimer)
      
      this.jumpTimer = setInterval(() => {
        velocity -= 0.85
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
      let newUnlockType = null
      
      if (this.score >= 600 && this.availableObstacles.indexOf('tiger') === -1) {
        this.availableObstacles.push('tiger')
        newUnlockType = 'tiger'
      } else if (this.score >= 300 && this.availableObstacles.indexOf('bird') === -1) {
        this.availableObstacles.push('bird')
        newUnlockType = 'bird'
      } else if (this.score >= 100 && this.availableObstacles.indexOf('rock') === -1) {
        this.availableObstacles.push('rock')
        newUnlockType = 'rock'
      }
      
      let type
      if (newUnlockType) {
        type = newUnlockType
      } else {
        type = this.availableObstacles[Math.floor(Math.random() * this.availableObstacles.length)]
      }
      
      let height = 50 + Math.random() * 30
      let width = 35
      let bottom = 30
      
      if (type === 'cactus') {
        width = 25
        height = 50 + Math.random() * 30
      } else if (type === 'rock') {
        width = 40
        height = 35 + Math.random() * 15
      } else if (type === 'bird') {
        width = 50
        height = 30
        bottom = 60 + Math.random() * 60
      } else if (type === 'tiger') {
        width = 55
        height = 40
      }
      
      this.obstacles.push({
        id: Date.now() + Math.random(),
        type: type,
        x: this.gameAreaWidth + 50,
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
        const obsLeft = obstacle.x
        const obsRight = obstacle.x + obstacle.width
        const obsBottom = obstacle.bottom || this.groundY
        const obsTop = obsBottom + obstacle.height

        if (dinoRight > obsLeft + 3 && dinoLeft < obsRight - 3 && 
            dinoTop > obsBottom + 3 && dinoBottom < obsTop - 3) {
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
  background: #f5f5f5;
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
  background: linear-gradient(180deg, #87CEEB 0%, #E0F6FF 100%);
}

.start-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30rpx;
}

.network-error {
  font-size: 28rpx;
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
  padding: 15rpx 30rpx;
  border-radius: 30rpx;
  border: 2rpx solid rgba(255, 107, 107, 0.3);
}

.logo-wrapper {
  width: 160rpx;
  height: 160rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.1);
}

.logo {
  width: 120rpx;
  height: 120rpx;
}

.start-title {
  font-size: 40rpx;
  font-weight: 600;
  color: #333;
}

.start-hint {
  font-size: 26rpx;
  color: #666;
}

.game-area {
  position: relative;
  width: 100%;
  height: 100%;
}

.score-panel {
  position: absolute;
  top: 60rpx;
  right: 30rpx;
  padding: 15rpx 25rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.1);
  border-radius: 15rpx;
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
  background: rgba(255, 255, 255, 0.8);
}

.high-score {
  position: absolute;
  top: 60rpx;
  left: 30rpx;
  padding: 15rpx 25rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.1);
  border-radius: 15rpx;
  font-size: 26rpx;
  color: #666;
  background: rgba(255, 255, 255, 0.8);
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
  border-radius: 6rpx;
  background: #4CAF50;

  &.rock {
    background: #795548;
    border-radius: 8rpx 8rpx 4rpx 4rpx;
  }
  
  &.bird {
    background: linear-gradient(135deg, #5D4E6D 0%, #3D3447 100%);
    border-radius: 50% 50% 50% 50%;
    position: relative;
    
    &::before, &::after {
      content: '';
      position: absolute;
      background: #5D4E6D;
      width: 15px;
      height: 8px;
      border-radius: 50%;
      top: 5px;
    }
    
    &::before {
      left: -10px;
      transform: rotate(-30deg);
    }
    
    &::after {
      right: -10px;
      transform: rotate(30deg);
    }
  }
  
  &.tiger {
    background: linear-gradient(135deg, #FFA500 0%, #FF8C00 100%);
    border-radius: 10rpx 10rpx 5rpx 5rpx;
    position: relative;
    
    &::before {
      content: '';
      position: absolute;
      top: 5px;
      left: 8px;
      width: 8px;
      height: 8px;
      background: #000;
      border-radius: 50%;
    }
    
    &::after {
      content: '';
      position: absolute;
      top: 5px;
      right: 8px;
      width: 8px;
      height: 8px;
      background: #000;
      border-radius: 50%;
    }
  }
}

.ground {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30px;
  background: #e0e0e0;
  border-top: 4px solid #c0c0c0;
}

.game-over {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.game-over-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30rpx;
  padding: 60rpx 80rpx;
  background: #fff;
  border: 2rpx solid rgba(0, 0, 0, 0.1);
  border-radius: 30rpx;
}

.game-over-title {
  font-size: 40rpx;
  font-weight: 600;
  color: #333;
}

.final-score-value {
  font-size: 70rpx;
  font-weight: bold;
  color: #ff6b6b;
}

.new-record {
  padding: 10rpx 25rpx;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  border-radius: 25rpx;
  font-size: 28rpx;
  color: #fff;
  font-weight: 600;
}

.restart-hint {
  font-size: 26rpx;
  color: #999;
}
</style>