<template>
  <view class="container">
    <view class="logo">
      <view class="logo-icon">
        <text class="icon">🔍</text>
      </view>
      <text class="logo-text">校园失物招领</text>
    </view>
    
    <view class="form">
      <view class="form-item">
        <text class="label">学号</text>
        <input 
          v-model="form.studentId" 
          type="number" 
          placeholder="请输入学号" 
          class="input"
        />
      </view>
      
      <view class="form-item">
        <text class="label">密码</text>
        <input 
          v-model="form.password" 
          type="password" 
          placeholder="请输入密码" 
          class="input"
        />
      </view>
      
      <view class="form-item">
        <view class="checkbox" :class="{ checked: form.remember }" @click="form.remember = !form.remember">
          <text v-if="form.remember">✓</text>
        </view>
        <text class="checkbox-text">记住我</text>
      </view>
      
      <button class="submit-btn" :disabled="!canSubmit" @click="handleLogin">登录</button>
      
      <view class="link-row">
        <text class="link" @click="goRegister">还没有账号？立即注册</text>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { storage } from '@/utils/storage'

export default {
  data() {
    return {
      form: {
        studentId: '',
        password: '',
        remember: false
      },
      isSubmitting: false
    }
  },
  computed: {
    canSubmit() {
      return this.form.studentId && this.form.password && !this.isSubmitting
    }
  },
  methods: {
    async handleLogin() {
      if (!this.canSubmit) return
      
      this.isSubmitting = true
      uni.showLoading({ title: '登录中...' })
      try {
        const res = await api.login({
          studentId: this.form.studentId,
          password: this.form.password
        })
        
        uni.hideLoading()
        
        // 检测是否有其他设备登录
        if (res.hasOtherDevice) {
          this.showForceLoginConfirm(res)
        } else {
          this.completeLogin(res)
        }
      } catch (err) {
        this.isSubmitting = false
        uni.hideLoading()
        uni.showToast({ title: err.message || '登录失败', icon: 'none' })
      }
    },
    showForceLoginConfirm(res) {
      uni.showModal({
        title: '登录提示',
        content: '该账号已在其他设备登录，是否顶号登录？',
        confirmText: '顶号登录',
        confirmColor: '#334155',
        cancelText: '取消',
        success: async (modalRes) => {
          if (modalRes.confirm) {
            await this.forceLogin()
          }
        }
      })
    },
    async forceLogin() {
      this.isSubmitting = true
      uni.showLoading({ title: '登录中...' })
      try {
        const res = await api.forceLogin({
          studentId: this.form.studentId,
          password: this.form.password
        })
        this.completeLogin(res)
      } catch (err) {
        this.isSubmitting = false
        uni.hideLoading()
        uni.showToast({ title: err.message || '登录失败', icon: 'none' })
      }
    },
    completeLogin(res) {
      storage.setUser(res.user)
      storage.setToken(res.token)
      
      uni.hideLoading()
      uni.showToast({ title: '登录成功', icon: 'success' })
      
      api.resetHeartbeat()
      
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/index/index' })
      }, 1500)
    },
    goRegister() {
      uni.navigateTo({ url: '/pages/auth/register' })
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  padding: 60rpx 40rpx;
  background: linear-gradient(180deg, #334155 0%, #1e293b 100%);
}

.logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
}

.logo-icon {
  width: 120rpx;
  height: 120rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.icon {
  font-size: 50rpx;
}

.logo-text {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}

.form {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 40rpx;
  box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.1);
}

.form-item {
  margin-bottom: 30rpx;
}

.label {
  font-size: 28rpx;
  color: #999;
  margin-bottom: 10rpx;
  display: block;
}

.input {
  width: 100%;
  height: 80rpx;
  border: 2rpx solid #eee;
  border-radius: 10rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #ccc;
  border-radius: 6rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #334155;
  margin-right: 10rpx;
}

.checkbox.checked {
  background: #334155;
  border-color: #334155;
  color: #fff;
}

.checkbox-text {
  font-size: 26rpx;
  color: #999;
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  background: #334155;
  color: #fff;
  border-radius: 44rpx;
  font-size: 32rpx;
  margin-top: 20rpx;
}

.submit-btn[disabled] {
  opacity: 0.5;
}

.link-row {
  text-align: center;
  margin-top: 30rpx;
}

.link {
  font-size: 26rpx;
  color: #334155;
}
</style>