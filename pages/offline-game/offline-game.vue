<template>
  <view class="game-container" :class="{ night: isNight }" @click="handleClick">
    <!-- 开始界面 -->
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

    <!-- 游戏界面 -->
    <view v-if="gameStarted && !gameOver" class="game-area">
      <!-- 分数 -->
      <view class="score-panel">
        <text class="score-value">{{ score }}</text>
      </view>

      <!-- 最高分 -->
      <view class="high-score">
        <text>{{ highScore }}</text>
      </view>

      <!-- 恐龙 -->
      <view class="dino" :style="{ bottom: (groundY + dinoY) + 'px' }">
        <image src="/uniapp_1145114/person.png" class="dino-img" mode="aspectFit" />
      </view>

      <!-- 障碍物 -->
      <view 
        v-for="obstacle in obstacles" 
        :key="obstacle.id"
        class="obstacle"
        :class="[obstacle.type, { night: isNight }]"
        :style="{ left: obstacle.x + 'px', height: obstacle.height + 'px' }"
      ></view>

      <!-- 地面 -->
      <view class="ground"></view>
    </view>

    <!-- 游戏结束 -->
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
      isNight: false,
      obstacles: [],
      gameLoop: null,
      baseSpeed: 6,
      currentSpeed: 6,
      speedLevel: 1,
      jumpHeight: 150,
      groundY: 30,
      gameAreaWidth: 375,
      gameAreaHeight: 500,
      obstacleId: 0,
      scoreTimer: null,
      obstacleTimer: null,
      jumpTimer: null,
      jumpVelocity: 0,
      dinoY: 0,
      isJumpingUp: false,
      fromSettings: false
    }
  },
  onLoad(options) {
    // 检查是否从设置页面跳转过来
    if (options && options.fromSettings === 'true') {
      this.fromSettings = true
    }
    
    // 获取屏幕信息
    const systemInfo = uni.getSystemInfoSync()
    this.gameAreaWidth = systemInfo.windowWidth
    this.gameAreaHeight = systemInfo.windowHeight - 100
    
    // 获取最高分
    try {
      const saved = uni.getStorageSync('dino_high_score')
      if (saved) this.highScore = parseInt(saved) || 0
    } catch (e) {}
  },
  onUnload() {
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
      this.gameStarted = true
      this.gameOver = false
      this.score = 0
      this.obstacles = []
      this.currentSpeed = this.baseSpeed
      this.speedLevel = 1
      this.isNight = false
      this.dinoY = 0

      // 开始游戏循环
      this.gameLoop = setInterval(() => this.update(), 30)
      
      // 生成障碍物
      this.obstacleTimer = setInterval(() => {
        if (!this.gameOver) {
          this.generateObstacle()
        }
      }, 1800)
      
      // 计分
      this.scoreTimer = setInterval(() => {
        this.score++
        
        // 每30分加速
        if (this.score % 30 === 0 && this.currentSpeed < 15) {
          this.currentSpeed += 0.5
          this.speedLevel = this.currentSpeed / this.baseSpeed
        }
        
        // 每100分再加速
        if (this.score % 100 === 0 && this.currentSpeed < 18) {
          this.currentSpeed += 1
          this.speedLevel = this.currentSpeed / this.baseSpeed
        }
        
        // 每1000分切换白天/黑夜
        if (this.score % 1000 === 0) {
          this.isNight = !this.isNight
        }
      }, 100)
    },

    stopGame() {
      if (this.gameLoop) clearInterval(this.gameLoop)
      if (this.obstacleTimer) clearInterval(this.obstacleTimer)
      if (this.scoreTimer) clearInterval(this.scoreTimer)
      if (this.jumpTimer) clearInterval(this.jumpTimer)
      
      this.gameLoop = null
      this.obstacleTimer = null
      this.scoreTimer = null
      this.jumpTimer = null
    },

    jump() {
      if (this.isJumping) return
      
      this.isJumping = true
      this.isJumpingUp = true
      this.jumpVelocity = 24
      this.dinoY = 0

      const jumpInterval = setInterval(() => {
        if (this.isJumpingUp) {
          this.jumpVelocity -= 1.2
          this.dinoY += this.jumpVelocity
          
          if (this.jumpVelocity <= 0) {
            this.isJumpingUp = false
          }
        } else {
          this.jumpVelocity -= 1.2
          this.dinoY += this.jumpVelocity
          
          if (this.dinoY <= 0) {
            this.dinoY = 0
            this.isJumping = false
            clearInterval(jumpInterval)
            return
          }
        }
        
        if (this.dinoY < 0) {
          this.dinoY = 0
          this.isJumping = false
          clearInterval(jumpInterval)
        }
      }, 30)
    },

    update() {
      // 移动障碍物
      this.obstacles = this.obstacles.filter(obstacle => {
        obstacle.x -= this.currentSpeed
        return obstacle.x > -50
      })

      // 碰撞检测
      this.checkCollision()
    },

    generateObstacle() {
      const types = ['cactus', 'rock']
      const type = types[Math.floor(Math.random() * types.length)]
      
      let height = 60 + Math.random() * 40
      
      this.obstacles.push({
        id: this.obstacleId++,
        type: type,
        x: this.gameAreaWidth + 50,
        height: height,
        width: type === 'cactus' ? 25 : 35
      })
    },

    getObstacleHeight(obstacle) {
      return obstacle.height
    },

    checkCollision() {
      const dinoLeft = 30
      const dinoRight = 80
      const dinoTop = this.gameAreaHeight - this.groundY - 60 - this.dinoY
      const dinoBottom = this.gameAreaHeight - this.groundY - this.dinoY

      for (let obstacle of this.obstacles) {
        const obsLeft = obstacle.x
        const obsRight = obstacle.x + obstacle.width
        const obsTop = this.gameAreaHeight - this.groundY - obstacle.height
        const obsBottom = this.gameAreaHeight - this.groundY

        if (dinoRight > obsLeft + 5 && dinoLeft < obsRight - 5 && 
            dinoBottom > obsTop + 5 && dinoTop < obsBottom - 5) {
          this.endGame()
          return
        }
      }
    },

    endGame() {
      this.gameOver = true
      this.stopGame()
      
      // 保存最高分
      if (this.score > this.highScore) {
        this.highScore = this.score
        try {
          uni.setStorageSync('dino_high_score', this.score.toString())
        } catch (e) {}
      }
    },

    restartGame() {
      this.gameStarted = false
      this.gameOver = false
      this.score = 0
      this.obstacles = []
      this.currentSpeed = this.baseSpeed
      this.speedLevel = 1
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
  transition: background 1s ease;
  overflow: hidden;
  z-index: 9999;
  user-select: none;

  &.night {
    background: #1a1a2e;

    .ground {
      background: #2d2d44;
    }

    .score-panel, .high-score {
      color: #fff;
      border-color: rgba(255, 255, 255, 0.3);
    }

    .game-over-content {
      background: #2d2d44;
      border-color: rgba(255, 255, 255, 0.2);
      .game-over-title, .final-score-value, .restart-hint {
        color: #fff;
      }
    }
  }
}

/* 开始界面 */
.start-screen {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
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
  color: #999;
}

/* 游戏区域 */
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
}

/* 恐龙 */
.dino {
  position: absolute;
  left: 30px;
  width: 50px;
  height: 60px;
  transition: bottom 0.03s linear;
}

.dino-img {
  width: 100%;
  height: 100%;
}

/* 障碍物 */
.obstacle {
  position: absolute;
  bottom: 30px;
  width: 25px;
  border-radius: 6rpx;
  transition: background 1s ease;

  &.cactus {
    background: #4CAF50;
    box-shadow: 0 0 20rpx rgba(76, 175, 80, 0.6);
  }

  &.rock {
    background: #795548;
    width: 30px;
    border-radius: 8rpx 8rpx 4rpx 4rpx;
    box-shadow: 0 0 20rpx rgba(121, 85, 72, 0.6);
  }

  &.night.cactus {
    background: #81C784;
    box-shadow: 0 0 25rpx rgba(129, 199, 132, 0.8), inset 0 0 15rpx rgba(255, 255, 255, 0.3);
  }

  &.night.rock {
    background: #8D6E63;
    box-shadow: 0 0 25rpx rgba(141, 110, 99, 0.8), inset 0 0 15rpx rgba(255, 255, 255, 0.3);
  }
}

/* 地面 */
.ground {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30px;
  background: #e0e0e0;
}

/* 游戏结束 */
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
