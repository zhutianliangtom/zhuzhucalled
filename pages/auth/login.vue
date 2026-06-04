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
      }
    }
  },
  computed: {
    canSubmit() {
      return this.form.studentId && this.form.password
    }
  },
  methods: {
    async handleLogin() {
      if (!this.canSubmit) return
      
      uni.showLoading({ title: '登录中...' })
      try {
        const res = await api.login({
          studentId: this.form.studentId,
          password: this.form.password
        })
        
        storage.setUser(res.user)
        storage.setToken(res.token)
        
        uni.hideLoading()
        uni.showToast({ title: '登录成功', icon: 'success' })
        
        // 登录成功后启动心跳检测
        api.resetHeartbeat()
        
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/index/index' })
        }, 1500)
      } catch (err) {
        uni.hideLoading()
        uni.showToast({ title: err.message || '登录失败', icon: 'none' })
      }
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
  background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
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
  color: #2563eb;
  margin-right: 10rpx;
}

.checkbox.checked {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.checkbox-text {
  font-size: 26rpx;
  color: #999;
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  background: #2563eb;
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
  color: #2563eb;
}
</style>