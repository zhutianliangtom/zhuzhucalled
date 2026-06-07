<template>
  <view class="game-container" :class="{ night: isNight }" @click="handleClick">
    <!-- 断网提示 -->
    <view v-if="!gameStarted && !gameOver" class="offline-prompt">
      <view class="prompt-content">
        <text class="prompt-icon">📡</text>
        <text class="prompt-text">你的连接丢失了</text>
        <text class="prompt-hint">点击下方图标开始游戏</text>
        <view class="game-icon-wrapper">
          <image src="/uniapp_1145114/person.png" class="game-icon" mode="aspectFit" />
        </view>
      </view>
    </view>

    <!-- 游戏界面 -->
    <view v-if="gameStarted && !gameOver" class="game-area">
      <!-- 分数 -->
      <view class="score-panel">
        <text class="score-label">分数</text>
        <text class="score-value">{{ score }}</text>
      </view>

      <!-- 昼夜指示 -->
      <view class="day-night-indicator">
        <text>{{ isNight ? '🌙 夜晚' : '☀️ 白天' }}</text>
      </view>

      <!-- 恐龙 -->
      <view class="dino" :class="{ jumping: isJumping, ducking: isDucking }">
        <image src="/uniapp_1145114/person.png" class="dino-img" mode="aspectFit" />
      </view>

      <!-- 障碍物 -->
      <view 
        v-for="obstacle in obstacles" 
        :key="obstacle.id"
        class="obstacle"
        :class="[obstacle.type, { small: obstacle.height === 'small' }]"
        :style="{ left: obstacle.x + 'px', height: getObstacleHeight(obstacle) + 'px' }"
      >
        <view class="obstacle-body"></view>
      </view>

      <!-- 地面 -->
      <view class="ground"></view>

      <!-- 提示文字 -->
      <view class="tap-hint">
        <text>点击屏幕跳跃</text>
      </view>
    </view>

    <!-- 游戏结束 -->
    <view v-if="gameOver" class="game-over">
      <view class="game-over-content">
        <text class="game-over-icon">💀</text>
        <text class="game-over-title">游戏结束</text>
        <view class="final-score">
          <text class="final-score-label">最终得分</text>
          <text class="final-score-value">{{ score }}</text>
        </view>
        <text class="restart-hint">点击屏幕重新开始</text>
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
      isJumping: false,
      isDucking: false,
      isNight: false,
      dinoY: 0,
      dinoBottom: 40,
      groundY: 40,
      obstacles: [],
      gameLoop: null,
      obstacleSpeed: 5,
      baseSpeed: 5,
      minSpeed: 5,
      maxSpeed: 15,
      speedIncrement: 0.5,
      jumpHeight: 120,
      gravity: 8,
      jumpVelocity: 15,
      obstacleTimer: null,
      dayNightTimer: null,
      gameAreaWidth: 0,
      gameAreaHeight: 300,
      obstacleId: 0,
      scoreTimer: null
    }
  },
  onLoad() {
    this.initGame()
  },
  onUnload() {
    this.stopGame()
  },
  methods: {
    initGame() {
      // 获取屏幕宽度
      const systemInfo = uni.getSystemInfoSync()
      this.gameAreaWidth = systemInfo.windowWidth
      this.gameAreaHeight = systemInfo.windowHeight - 100
    },

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
      this.obstacleSpeed = this.baseSpeed
      this.isNight = false

      // 开始游戏循环
      this.gameLoop = setInterval(this.update, 30)
      
      // 开始生成障碍物
      this.obstacleTimer = setInterval(this.generateObstacle, 1500)
      
      // 开始昼夜切换
      this.dayNightTimer = setInterval(this.toggleDayNight, 8000)
      
      // 开始计分
      this.scoreTimer = setInterval(() => {
        this.score++
        // 每50分加速
        if (this.score % 50 === 0 && this.obstacleSpeed < this.maxSpeed) {
          this.obstacleSpeed += this.speedIncrement
        }
      }, 100)
    },

    stopGame() {
      if (this.gameLoop) {
        clearInterval(this.gameLoop)
        this.gameLoop = null
      }
      if (this.obstacleTimer) {
        clearInterval(this.obstacleTimer)
        this.obstacleTimer = null
      }
      if (this.dayNightTimer) {
        clearInterval(this.dayNightTimer)
        this.dayNightTimer = null
      }
      if (this.scoreTimer) {
        clearInterval(this.scoreTimer)
        this.scoreTimer = null
      }
    },

    jump() {
      if (this.isJumping) return
      
      this.isJumping = true
      let velocity = this.jumpVelocity
      let position = 0
      
      const jumpInterval = setInterval(() => {
        velocity -= this.gravity
        position += velocity
        
        if (position <= 0) {
          position = 0
          velocity = this.jumpVelocity
          clearInterval(jumpInterval)
          this.isJumping = false
        }
        
        this.dinoY = position
      }, 30)
    },

    update() {
      // 更新障碍物位置
      this.obstacles = this.obstacles.filter(obstacle => {
        obstacle.x -= this.obstacleSpeed
        return obstacle.x > -50
      })

      // 碰撞检测
      this.checkCollision()
    },

    generateObstacle() {
      if (this.gameOver) return

      const obstacleTypes = ['cactus', 'bird', 'rock']
      const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)]
      
      let height = 'normal'
      let obstacleHeight = 50
      
      if (type === 'bird') {
        height = Math.random() > 0.5 ? 'high' : 'low'
        obstacleHeight = height === 'high' ? 80 : 60
      } else if (type === 'rock') {
        height = 'small'
        obstacleHeight = 30
      }

      this.obstacles.push({
        id: this.obstacleId++,
        type: type,
        x: this.gameAreaWidth + 50,
        height: height,
        obstacleHeight: obstacleHeight
      })

      // 随机调整速度
      const speedVariation = (Math.random() - 0.5) * 2
      this.obstacleSpeed = Math.max(this.minSpeed, Math.min(this.maxSpeed, this.baseSpeed + this.score / 20 + speedVariation))
    },

    getObstacleHeight(obstacle) {
      if (obstacle.type === 'bird') {
        return obstacle.height === 'high' ? 40 : 60
      }
      return obstacle.obstacleHeight || 50
    },

    checkCollision() {
      const dinoLeft = 30
      const dinoRight = 80
      const dinoTop = this.gameAreaHeight - this.groundY - 60 - this.dinoY
      const dinoBottom = this.gameAreaHeight - this.groundY - this.dinoY

      for (let obstacle of this.obstacles) {
        const obsLeft = obstacle.x
        const obsRight = obstacle.x + 30
        const obsTop = this.gameAreaHeight - this.groundY - (obstacle.obstacleHeight || 50)
        const obsBottom = this.gameAreaHeight - this.groundY

        // 简单碰撞检测
        if (dinoRight > obsLeft && dinoLeft < obsRight && dinoBottom > obsTop && dinoTop < obsBottom) {
          this.endGame()
          return
        }
      }
    },

    toggleDayNight() {
      this.isNight = !this.isNight
    },

    endGame() {
      this.gameOver = true
      this.stopGame()
    },

    restartGame() {
      this.stopGame()
      this.gameStarted = false
      this.gameOver = false
      this.score = 0
      this.obstacles = []
      this.obstacleSpeed = this.baseSpeed
      this.isNight = false
      this.dinoY = 0
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
  background: #ffffff;
  transition: background 0.5s ease;
  overflow: hidden;
  z-index: 9999;

  &.night {
    background: #1a1a2e;

    .ground {
      background: #2d2d44;
    }

    .dino-img {
      filter: brightness(0.8);
    }

    .obstacle-body {
      background: #4a4a6a;
    }

    .score-panel {
      background: rgba(255, 255, 255, 0.1);
      .score-label, .score-value {
        color: #fff;
      }
    }

    .day-night-indicator {
      color: #ffd93d;
    }
  }
}

/* 断网提示 */
.offline-prompt {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}

.prompt-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30rpx;
  padding: 60rpx;
}

.prompt-icon {
  font-size: 80rpx;
}

.prompt-text {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

.prompt-hint {
  font-size: 28rpx;
  color: #666;
}

.game-icon-wrapper {
  margin-top: 40rpx;
  width: 200rpx;
  height: 200rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.1);
  animation: bounce 2s ease-in-out infinite;
}

.game-icon {
  width: 160rpx;
  height: 160rpx;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20rpx); }
}

/* 游戏区域 */
.game-area {
  position: relative;
  width: 100%;
  height: 100%;
}

.score-panel {
  position: absolute;
  top: 100rpx;
  right: 30rpx;
  padding: 20rpx 30rpx;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 20rpx;
  text-align: center;
}

.score-label {
  display: block;
  font-size: 24rpx;
  color: #666;
  margin-bottom: 8rpx;
}

.score-value {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
}

.day-night-indicator {
  position: absolute;
  top: 100rpx;
  left: 30rpx;
  padding: 15rpx 25rpx;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 20rpx;
  font-size: 28rpx;
}

/* 恐龙 */
.dino {
  position: absolute;
  left: 30px;
  bottom: 40px;
  width: 60px;
  height: 70px;
  transition: transform 0.1s;

  &.jumping {
    animation: jump 0.3s ease-out;
  }
}

.dino-img {
  width: 100%;
  height: 100%;
}

@keyframes jump {
  0% { transform: translateY(0); }
  50% { transform: translateY(-120px); }
  100% { transform: translateY(0); }
}

/* 障碍物 */
.obstacle {
  position: absolute;
  bottom: 40px;
  width: 30px;

  &.bird {
    bottom: 120px;
  }
}

.obstacle-body {
  width: 100%;
  height: 100%;
  background: #4CAF50;
  border-radius: 8px;

  .cactus & {
    background: linear-gradient(90deg, #4CAF50 50%, #388E3C 50%);
    background-size: 15px 100%;
  }

  .bird & {
    background: #FF9800;
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  }

  .rock & {
    background: #795548;
    border-radius: 8px 8px 4px 4px;
  }
}

/* 地面 */
.ground {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: #e0e0e0;
  border-top: 4px solid #bdbdbd;
}

.tap-hint {
  position: absolute;
  bottom: 80px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 28rpx;
  color: #999;
}

/* 游戏结束 */
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
  gap: 30rpx;
  padding: 60rpx;
  background: #fff;
  border-radius: 30rpx;
}

.game-over-icon {
  font-size: 100rpx;
}

.game-over-title {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
}

.final-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}

.final-score-label {
  font-size: 28rpx;
  color: #666;
}

.final-score-value {
  font-size: 72rpx;
  font-weight: bold;
  color: #ff6b6b;
}

.restart-hint {
  font-size: 28rpx;
  color: #999;
  margin-top: 20rpx;
}
</style>
