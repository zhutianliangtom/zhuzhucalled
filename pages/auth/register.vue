<template>
  <view class="container">
    <view class="header">
      <text class="title">注册账号</text>
    </view>
    
    <view class="form">
      <view class="avatar-upload">
        <text class="label">头像</text>
        <view class="avatar-wrapper" @click="chooseAvatar">
          <image v-if="form.avatar" :src="form.avatar" class="avatar" />
          <view v-else class="avatar-placeholder">
            <text class="avatar-icon">+</text>
          </view>
        </view>
        <text class="avatar-tip">点击上传头像（可选）</text>
      </view>
      
      <view class="form-item">
        <text class="label">学号 *</text>
        <input 
          v-model="form.studentId" 
          type="number" 
          placeholder="请输入学号" 
          class="input"
        />
      </view>
      
      <view class="form-item">
        <text class="label">昵称 *</text>
        <input 
          v-model="form.name" 
          type="text" 
          placeholder="请输入昵称" 
          class="input"
        />
      </view>
      
      <view class="form-item">
        <text class="label">手机号 *</text>
        <input 
          v-model="form.phone" 
          type="number" 
          placeholder="请输入手机号" 
          class="input"
        />
      </view>
      
      <view class="form-item">
        <text class="label">班级 *</text>
        <input 
          v-model="form.className" 
          type="text" 
          placeholder="请输入班级（如：计算机2301班）" 
          class="input"
        />
      </view>
      
      <view class="form-item">
        <text class="label">密码 *</text>
        <input 
          v-model="form.password" 
          type="password" 
          placeholder="请输入密码" 
          class="input"
        />
      </view>
      
      <view class="form-item">
        <text class="label">确认密码 *</text>
        <input 
          v-model="form.confirmPassword" 
          type="password" 
          placeholder="请再次输入密码" 
          class="input"
        />
      </view>
      
      <button class="submit-btn" :disabled="!canSubmit" @click="handleRegister">注册</button>
      
      <view class="link-row">
        <text class="link" @click="goLogin">已有账号？立即登录</text>
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
        name: '',
        phone: '',
        className: '',
        password: '',
        confirmPassword: '',
        avatar: ''
      }
    }
  },
  computed: {
    canSubmit() {
      return this.form.studentId && this.form.name && this.form.phone && 
             this.form.className && this.form.password && this.form.confirmPassword &&
             this.form.password === this.form.confirmPassword
    }
  },
  methods: {
    chooseAvatar() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          console.log('[注册] 选择图片成功:', res.tempFilePaths[0])
          const filePath = res.tempFilePaths[0]
          uni.showLoading({ title: '上传中...' })
          try {
            const result = await api.uploadAvatarImage(filePath)
            console.log('[注册] 上传成功:', result.url)
            this.form.avatar = result.url
            uni.hideLoading()
            uni.showToast({ title: '头像已设置', icon: 'success' })
          } catch (err) {
            uni.hideLoading()
            console.error('[注册] 上传失败:', err)
            uni.showToast({ title: err.message || '上传失败', icon: 'none', duration: 3000 })
          }
        },
        fail: (err) => {
          console.error('[注册] 选择图片失败:', err)
          uni.showToast({ title: '选择图片失败', icon: 'none' })
        }
      })
    },
    async handleRegister() {
      if (!this.canSubmit) {
        if (this.form.password !== this.form.confirmPassword) {
          uni.showToast({ title: '两次输入的密码不一致', icon: 'none' })
        } else {
          uni.showToast({ title: '请填写完整信息', icon: 'none' })
        }
        return
      }
      
      uni.showLoading({ title: '注册中...' })
      try {
        await api.register({
          studentId: this.form.studentId,
          name: this.form.name,
          phone: this.form.phone,
          password: this.form.password,
          className: this.form.className,
          avatar: this.form.avatar
        })
        
        uni.hideLoading()
        uni.showToast({ title: '注册成功，请等待管理员审核', icon: 'success' })
        
        setTimeout(() => {
          uni.navigateBack()
        }, 2000)
      } catch (err) {
        uni.hideLoading()
        uni.showToast({ title: err.message || '注册失败', icon: 'none' })
      }
    },
    goLogin() {
      uni.navigateBack()
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  padding: 40rpx;
  background: #0f0f1a;
}

.header {
  padding: 40rpx 0;
  text-align: center;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #e0e0e0;
}

.form {
  background: #1a1a2e;
  border-radius: 20rpx;
  padding: 40rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.avatar-upload {
  margin-bottom: 30rpx;
}

.avatar-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 10rpx;
}

.avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  border: 2rpx solid #2a2a3e;
}

.avatar-placeholder {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  border: 2rpx dashed #555;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-icon {
  font-size: 48rpx;
  color: #777;
}

.avatar-tip {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #777;
  margin-top: 10rpx;
}

.form-item {
  margin-bottom: 30rpx;
}

.label {
  font-size: 28rpx;
  color: #777;
  margin-bottom: 10rpx;
  display: block;
}

.input {
  width: 100%;
  height: 80rpx;
  border: 2rpx solid #2a2a3e;
  border-radius: 10rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #4f8cff 0%, #6c63ff 100%);
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
  color: #4f8cff;
}
</style>