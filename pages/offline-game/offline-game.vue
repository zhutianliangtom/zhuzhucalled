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
        :style="{ left: obstacle.x + 'px', height: obstacle.height + 'px', bottom: obstacle.y + 'px', width: obstacle.width + 'px' }"
      ></view>

      <!-- 地面 -->
      <view class="ground"></view>

      <!-- 云 -->
      <view v-for="cloud in clouds" :key="cloud.id" class="cloud" :style="{ left: cloud.x + 'px', top: cloud.y + 'px', width: cloud.width + 'px' }"></view>
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
      clouds: [],
      gameLoop: null,
      baseSpeed: 6,
      currentSpeed: 6,
      groundY: 30,
      gameAreaWidth: 375,
      gameAreaHeight: 500,
      obstacleId: 0,
      cloudId: 0,
      jumpVelocity: 0,
      dinoY: 0,
      isJumpingUp: false,
      fromSettings: false,
      difficultyLevel: 1,
      
      _lastScoreTime: 0,
      _lastObstacleTime: 0,
      _lastCloudTime: 0,
      _targetObstacleInterval: 1800,
      _targetCloudInterval: 4000
    }
  },
  onLoad(options) {
    if (options && options.fromSettings === 'true') {
      this.fromSettings = true
    }
    
    const systemInfo = uni.getSystemInfoSync()
    this.gameAreaWidth = systemInfo.windowWidth
    this.gameAreaHeight = systemInfo.windowHeight - 100
    
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
      this.clouds = []
      this.currentSpeed = this.baseSpeed
      this.isNight = false
      this.dinoY = 0
      this.difficultyLevel = 1
      this._lastScoreTime = Date.now()
      this._lastObstacleTime = Date.now()
      this._lastCloudTime = Date.now()
      
      this.generateCloud()
      
      const loop = () => {
        if (this.gameOver) return
        this.update()
        this.gameLoop = requestAnimationFrame(loop)
      }
      this.gameLoop = requestAnimationFrame(loop)
    },

    stopGame() {
      if (this.gameLoop) {
        cancelAnimationFrame(this.gameLoop)
        this.gameLoop = null
      }
    },

    jump() {
      if (this.isJumping) return
      
      this.isJumping = true
      this.isJumpingUp = true
      this.jumpVelocity = 24
      this.dinoY = 0

      const gravity = 0.4
      const jumpInterval = setInterval(() => {
        if (this.gameOver) {
          clearInterval(jumpInterval)
          return
        }
        
        this.jumpVelocity -= gravity
        this.dinoY += this.jumpVelocity
        
        if (this.dinoY <= 0) {
          this.dinoY = 0
          this.isJumping = false
          clearInterval(jumpInterval)
        }
      }, 16)
    },

    update() {
      const now = Date.now()
      
      // 计分逻辑
      if (now - this._lastScoreTime >= 100) {
        this._lastScoreTime = now
        this.score++
        
        if (this.score % 200 === 0) {
          this.difficultyLevel = Math.min(5, Math.floor(this.score / 200) + 1)
        }
        
        if (this.score % 30 === 0 && this.currentSpeed < 15) {
          this.currentSpeed += 0.5
        }
        
        if (this.score % 100 === 0 && this.currentSpeed < 18) {
          this.currentSpeed += 1
        }
        
        if (this.score % 1000 === 0) {
          this.isNight = !this.isNight
        }
        
        // 动态调整障碍物生成间隔
        this._targetObstacleInterval = Math.max(800, 1800 - this.score * 2)
      }
      
      // 生成障碍物
      if (now - this._lastObstacleTime >= this._targetObstacleInterval) {
        this._lastObstacleTime = now
        this.generateObstacle()
      }
      
      // 生成云
      if (now - this._lastCloudTime >= this._targetCloudInterval) {
        this._lastCloudTime = now
        this.generateCloud()
      }
      
      // 移动障碍物
      const speed = this.currentSpeed
      const obstacles = this.obstacles
      let obstacleCount = obstacles.length
      for (let i = obstacleCount - 1; i >= 0; i--) {
        obstacles[i].x -= speed
        if (obstacles[i].x < -100) {
          obstacles.splice(i, 1)
          obstacleCount--
        }
      }
      
      // 移动云
      const clouds = this.clouds
      const cloudSpeed = speed * 0.3
      for (let i = clouds.length - 1; i >= 0; i--) {
        clouds[i].x -= cloudSpeed
        if (clouds[i].x < -200) {
          clouds.splice(i, 1)
        }
      }
      
      // 限制障碍物数量
      if (obstacles.length > 10) {
        obstacles.shift()
      }
      
      // 限制云数量
      if (clouds.length > 5) {
        clouds.shift()
      }
      
      // 碰撞检测
      this.checkCollision()
    },

    generateObstacle() {
      const types = ['cactus', 'rock']
      
      if (this.difficultyLevel >= 2) types.push('bird')
      if (this.difficultyLevel >= 3) types.push('spike')
      if (this.difficultyLevel >= 4) types.push('flying-rock')
      
      const type = types[Math.floor(Math.random() * types.length)]
      
      let height, width, y
      
      switch(type) {
        case 'cactus':
          height = 60 + Math.random() * 30
          width = 25
          y = this.groundY
          break
        case 'rock':
          height = 40 + Math.random() * 20
          width = 35
          y = this.groundY
          break
        case 'spike':
          height = 30 + Math.random() * 15
          width = 20
          y = this.groundY
          break
        case 'bird':
          height = 28
          width = 38
          const birdHeight = Math.random()
          y = birdHeight < 0.33 ? this.groundY + 40 : (birdHeight < 0.66 ? this.groundY + 80 : this.groundY + 120)
          break
        case 'flying-rock':
          height = 22
          width = 28
          y = this.groundY + 60 + Math.random() * 40
          break
        default:
          height = 50
          width = 25
          y = this.groundY
      }
      
      this.obstacles.push({
        id: this.obstacleId++,
        type: type,
        x: this.gameAreaWidth + 50,
        y: y,
        width: width,
        height: height
      })
      
      if (this.difficultyLevel >= 3 && Math.random() > 0.75) {
        const followTypes = ['cactus', 'rock', 'spike']
        const followType = followTypes[Math.floor(Math.random() * followTypes.length)]
        const followWidth = followType === 'spike' ? 20 : (followType === 'cactus' ? 25 : 35)
        
        setTimeout(() => {
          if (!this.gameOver) {
            this.obstacles.push({
              id: this.obstacleId++,
              type: followType,
              x: this.gameAreaWidth + 50,
              y: this.groundY,
              width: followWidth,
              height: 40 + Math.random() * 20
            })
          }
        }, 400)
      }
    },

    generateCloud() {
      if (this.clouds.length < 5) {
        this.clouds.push({
          id: this.cloudId++,
          x: this.gameAreaWidth + 100,
          y: 50 + Math.random() * 80,
          width: 50 + Math.random() * 30
        })
      }
    },

    checkCollision() {
      const dinoLeft = 30
      const dinoRight = 80
      const dinoTop = this.gameAreaHeight - this.groundY - 60 - this.dinoY
      const dinoBottom = this.gameAreaHeight - this.groundY - this.dinoY

      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i]
        const obsLeft = obs.x
        const obsRight = obs.x + obs.width
        const obsTop = this.gameAreaHeight - obs.y - obs.height
        const obsBottom = this.gameAreaHeight - obs.y

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
      this.clouds = []
      this.currentSpeed = this.baseSpeed
      this.dinoY = 0
      this.isJumping = false
      this.difficultyLevel = 1
      this._targetObstacleInterval = 1800
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
  background: #f0f0f0;
  overflow: hidden;
  z-index: 9999;
  user-select: none;

  &.night {
    background: #1a1a2e;

    .ground {
      background: #2d2d44;
      border-top: 4px solid #1a1a2e;
    }

    .score-panel, .high-score {
      color: #fff;
      border-color: rgba(255, 255, 255, 0.3);
      background: rgba(255, 255, 255, 0.1);
    }

    .game-over-content {
      background: #2d2d44;
      border-color: rgba(255, 255, 255, 0.2);
      .game-over-title, .final-score-value, .restart-hint {
        color: #fff;
      }
    }

    .cloud {
      background: rgba(255, 255, 255, 0.1);
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
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(5px);
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
  backdrop-filter: blur(5px);
}

/* 云 */
.cloud {
  position: absolute;
  height: 30px;
  background: #fff;
  border-radius: 50px;
  opacity: 0.8;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
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
  border-radius: 4rpx;

  &.cactus {
    background: #4CAF50;
  }

  &.rock {
    background: #795548;
    width: 35px;
    border-radius: 6rpx 6rpx 3rpx 3rpx;
  }

  &.spike {
    background: transparent;
    border-radius: 0;
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-bottom: 35px solid #ff4757;
  }

  &.bird {
    background: #FF9800;
    border-radius: 50% 50% 30% 30%;
  }

  &.flying-rock {
    background: #9E9E9E;
    border-radius: 50%;
  }

  &.night.cactus {
    background: #81C784;
  }

  &.night.rock {
    background: #8D6E63;
  }

  &.night.spike {
    border-bottom-color: #ff6b6b;
  }

  &.night.bird {
    background: #FFB74D;
  }

  &.night.flying-rock {
    background: #BDBDBD;
  }
}



/* 地面 */
.ground {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30px;
  background: linear-gradient(180deg, #C8E6C9 0%, #A5D6A7 100%);
  border-top: 4px solid #81C784;
}

/* 游戏结束 */
.game-over {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
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
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.3);
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
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.restart-hint {
  font-size: 26rpx;
  color: #999;
}
</style>
