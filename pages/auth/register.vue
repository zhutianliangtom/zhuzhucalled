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
      
      <view class="submit-wrapper">
        <button class="submit-btn" :disabled="!canSubmit" @click="handleRegister">注册</button>
        <text class="submit-tip">（请加18799784824的qq审核）</text>
      </view>
      
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
        success: (res) => {
          uni.navigateTo({
            url: `/pages/user/avatar-crop?src=${res.tempFilePaths[0]}`
          })
        },
        fail: () => {}
      })
    },
    async handleCropResult(tempFilePath) {
      uni.showLoading({ title: '上传中...' })
      try {
        const result = await api.uploadAvatarImage(tempFilePath)
        this.form.avatar = result.url
        uni.hideLoading()
        uni.showToast({ title: '头像已设置', icon: 'success' })
      } catch (err) {
        uni.hideLoading()
        uni.showToast({ title: err.message || '上传失败', icon: 'none' })
      }
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
        uni.showModal({
          title: '注册成功',
          content: '请等待管理员审核，审核通过后即可登录使用',
          showCancel: false,
          confirmText: '知道了',
          success: () => {
            uni.navigateBack()
          }
        })
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
  background: #f8f9fa;
}

.header {
  padding: 40rpx 0;
  text-align: center;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

.form {
  background: #ffffff;
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
  border: 2rpx solid #eee;
}

.avatar-placeholder {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  border: 2rpx dashed #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-icon {
  font-size: 48rpx;
  color: #999;
}

.avatar-tip {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #999;
  margin-top: 10rpx;
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

.submit-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 20rpx;
}

.submit-btn {
  width: 100%;
  max-width: 600rpx;
  min-width: 300rpx;
  height: 88rpx;
  background: #334155;
  color: #fff;
  border-radius: 44rpx;
  font-size: 32rpx;
}

.submit-btn[disabled] {
  opacity: 0.5;
}

.submit-tip {
  font-size: 24rpx;
  color: #999;
  margin-top: 16rpx;
  text-align: center;
  word-break: break-all;
  max-width: 100%;
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
