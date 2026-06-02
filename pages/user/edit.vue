<template>
  <view class="container">
    <view class="header">
      <text class="header-title">编辑资料</text>
      <view class="back-btn" @click="goBack">
        <text>‹</text>
      </view>
    </view>
    
    <view class="form-container">
      <view class="form-item">
        <text class="form-label">头像</text>
        <view class="avatar-wrapper" @click="chooseAvatar">
          <image v-if="formData.avatar" :src="getFullImageUrl(formData.avatar)" class="avatar" />
          <view v-else class="avatar">
            <text class="avatar-text">{{ user?.name?.charAt(0) || '?' }}</text>
          </view>
          <view class="avatar-edit">
            <text class="edit-icon">📷</text>
          </view>
        </view>
      </view>
      
      <view class="form-item">
        <text class="form-label">学号</text>
        <input class="form-input" :value="formData.studentId" disabled placeholder="学号" />
      </view>
      
      <view class="form-item">
        <text class="form-label">昵称</text>
        <input class="form-input" v-model="formData.name" placeholder="请输入昵称" />
      </view>
      
      <view class="form-item">
        <text class="form-label">班级</text>
        <input class="form-input" v-model="formData.className" placeholder="请输入班级" />
      </view>
      
      <view class="form-item">
        <text class="form-label">电话</text>
        <input class="form-input" v-model="formData.phone" placeholder="请输入手机号" type="number" />
      </view>
      
      <button class="submit-btn" @click="submitForm">保存修改</button>
    </view>
  </view>
</template>

<script>
import { storage } from '@/utils/storage'
import { api } from '@/utils/api'

export default {
  data() {
    return {
      user: null,
      formData: {
        studentId: '',
        name: '',
        className: '',
        phone: '',
        avatar: ''
      }
    }
  },
  onLoad() {
    this.user = storage.getUser()
    if (this.user) {
      this.formData = {
        studentId: this.user.studentId,
        name: this.user.name,
        className: this.user.className,
        phone: this.user.phone,
        avatar: this.user.avatar
      }
    }
  },
  methods: {
    getFullImageUrl(url) {
      if (!url) return ''
      // 如果已经是完整URL，直接返回
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
      }
      // 如果是相对路径，拼接baseUrl
      const baseUrl = 'https://chentian.dpdns.org'
      return baseUrl + url
    },
    goBack() {
      uni.navigateBack()
    },
    chooseAvatar() {
      const user = storage.getUser()
      if (!user) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          console.log('[头像] 选择图片成功:', res.tempFilePaths[0])
          const filePath = res.tempFilePaths[0]
          uni.navigateTo({
            url: `/pages/user/avatar-crop?imagePath=${encodeURIComponent(filePath)}`
          })
        },
        fail: (err) => {
          console.error('[头像] 选择图片失败:', err)
          uni.showToast({ title: '选择图片失败', icon: 'none' })
        }
      })
    },
    async handleCropResult(imagePath) {
      console.log('[头像] 裁剪完成，准备上传:', imagePath)
      uni.showLoading({ title: '上传中...' })
      try {
        const result = await api.uploadImage(imagePath)
        console.log('[头像] 上传成功:', result.url)
        this.formData.avatar = result.url
        uni.hideLoading()
        uni.showToast({ title: '头像已更新', icon: 'success' })
      } catch (err) {
        uni.hideLoading()
        console.error('[头像] 上传失败:', err)
        uni.showToast({ title: err.message || '上传失败', icon: 'none', duration: 3000 })
      }
    },
    async submitForm() {
      if (!this.formData.name) {
        uni.showToast({ title: '请输入昵称', icon: 'none' })
        return
      }
      
      uni.showLoading({ title: '保存中...' })
      try {
        await api.updateUserInfo({
          name: this.formData.name,
          className: this.formData.className,
          phone: this.formData.phone,
          avatar: this.formData.avatar
        })
        
        const updatedUser = { ...this.user, ...this.formData }
        storage.setUser(updatedUser)
        
        uni.hideLoading()
        uni.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => {
          uni.navigateBack()
        }, 1500)
      } catch (err) {
        uni.hideLoading()
        uni.showToast({ title: '保存失败', icon: 'none' })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #0f0f1a;
}

.header {
  display: flex;
  align-items: center;
  padding: 60rpx 30rpx 30rpx;
  background: #1a1a2e;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.back-btn text {
  font-size: 48rpx;
  color: #e0e0e0;
}

.header-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #e0e0e0;
}

.form-container {
  padding: 30rpx;
}

.form-item {
  background: #1a1a2e;
  padding: 30rpx;
  margin-bottom: 20rpx;
  border-radius: 15rpx;
}

.form-label {
  font-size: 28rpx;
  color: #777;
  margin-bottom: 15rpx;
  display: block;
}

.form-input {
  font-size: 32rpx;
  color: #e0e0e0;
  padding: 15rpx 0;
  border-bottom: 1rpx solid #2a2a3e;
}

.form-input:disabled {
  color: #777;
}

.avatar-wrapper {
  position: relative;
  display: inline-block;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(135deg, #4f8cff 0%, #6c63ff 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-wrapper image.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
}

.avatar-text {
  font-size: 48rpx;
  color: #fff;
  font-weight: bold;
}

.avatar-edit {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 40rpx;
  height: 40rpx;
  background: #1a1a2e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #fff;
}

.edit-icon {
  font-size: 20rpx;
}

.submit-btn {
  width: 100%;
  height: 90rpx;
  background: linear-gradient(135deg, #4f8cff 0%, #6c63ff 100%);
  color: #fff;
  border-radius: 45rpx;
  font-size: 32rpx;
  margin-top: 30rpx;
}
</style>