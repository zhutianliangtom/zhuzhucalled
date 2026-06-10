<template>
  <view>
    <!-- 离线游戏 -->
    <OfflineGame v-if="showOfflineGame" />
  </view>
</template>

<script>
import OfflineGame from '@/components/OfflineGame.vue'

export default {
  components: {
    OfflineGame
  },
  data() {
    return {
      showOfflineGame: false,
      isOnline: true,
      checkTimer: null,
      consecutiveFailures: 0,
      maxFailures: 2
    }
  },
  onLaunch() {
    this.initNetworkCheck()
  },
  onUnload() {
    this.stopNetworkCheck()
  },
  methods: {
    initNetworkCheck() {
      // 监听网络状态变化
      uni.onNetworkStatusChange((res) => {
        if (!res.isConnected) {
          this.handleOffline()
        } else {
          this.handleOnline()
        }
      })

      // 定期检查连接
      this.checkTimer = setInterval(() => {
        this.checkConnection()
      }, 5000)
    },

    stopNetworkCheck() {
      if (this.checkTimer) {
        clearInterval(this.checkTimer)
        this.checkTimer = null
      }
    },

    async checkConnection() {
      try {
        const response = await uni.request({
          url: 'https://chentian.dpdns.org/api/heartbeat',
          method: 'GET',
          timeout: 8000
        })

        this.consecutiveFailures = 0

        if (!this.isOnline) {
          this.handleOnline()
        }
      } catch (error) {
        this.consecutiveFailures++

        if (this.consecutiveFailures >= this.maxFailures) {
          this.handleOffline()
        }
      }
    },

    handleOffline() {
      if (!this.isOnline) return
      
      this.isOnline = false
      this.showOfflineGame = true
    },

    handleOnline() {
      if (this.isOnline) return
      
      this.isOnline = true
      this.showOfflineGame = false
      this.consecutiveFailures = 0
    }
  }
}
</script>
