<template>
  <view class="container">
    <view class="header" :style="{ paddingTop: (statusBarHeight + 10) + 'px' }">
      <text class="title">发布{{ form.type === 'lost' ? '寻物启事' : '失物招领' }}</text>
    </view>
    
    <view class="form">
      <view class="form-item">
        <text class="label">类型</text>
        <view class="type-selector">
          <view 
            class="type-option" 
            :class="{ active: form.type === 'lost' }"
            @click="form.type = 'lost'"
          >
            <text>寻物启事</text>
          </view>
          <view 
            class="type-option" 
            :class="{ active: form.type === 'found' }"
            @click="form.type = 'found'"
          >
            <text>失物招领</text>
          </view>
        </view>
      </view>
      
      <view class="form-item">
        <text class="label">物品名称</text>
        <input 
          v-model="form.title" 
          type="text" 
          placeholder="请输入物品名称" 
          class="input"
        />
      </view>
      
      <view class="form-item">
        <text class="label">物品描述</text>
        <textarea 
          v-model="form.description" 
          placeholder="请详细描述物品特征、丢失/发现地点等信息" 
          class="textarea"
          :maxlength="500"
        />
        <text class="word-count">{{ form.description.length }}/500</text>
      </view>
      
      <view class="form-item">
        <text class="label">上传图片</text>
        <view class="image-upload">
          <view 
            v-for="(img, index) in form.images" 
            :key="index" 
            class="image-item"
          >
            <image :src="img" mode="aspectFill" class="uploaded-image" />
            <text class="remove-btn" @click="removeImage(index)">✕</text>
          </view>
          <view v-if="form.images.length < 9" class="upload-btn" @click="chooseImage">
            <text class="upload-icon">+</text>
            <text class="upload-text">拍照/上传</text>
          </view>
        </view>
      </view>
      
      <view class="form-item">
        <text class="label">联系方式</text>
        <input 
          v-model="form.contact" 
          type="text" 
          placeholder="请输入手机号或其他联系方式" 
          class="input"
        />
      </view>
    </view>
    
    <view class="footer">
      <button class="submit-btn" :disabled="!canSubmit || isPublishing" @click="handleSubmit">
        <text v-if="!isPublishing">发布</text>
        <view v-else class="publishing">
          <text class="uploading-text">{{ uploadingText }}</text>
          <view class="progress-bar">
            <view class="progress-inner" :style="{width: uploadProgress + '%'}"></view>
          </view>
        </view>
      </button>
    </view>
    
    <view class="tabbar-container">
      <view class="custom-tabbar">
        <view class="tab-container">
          <view 
            v-for="(item, index) in tabBarItems" 
            :key="index"
            class="tab-bar-item"
            :class="{ active: currentTabBarIndex === index }"
            @click="handleTabClick(index)"
          >
            <!-- 消息 Tab 加角标 -->
            <view v-if="index === 1 && unreadTotal > 0" class="tab-badge">
              <text>{{ unreadTotal > 99 ? '99+' : unreadTotal }}</text>
            </view>
            <text class="tab-icon">{{ item.icon }}</text>
            <text class="tab-text">{{ item.text }}</text>
          </view>
        </view>
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
        type: 'lost',
        title: '',
        description: '',
        images: [],
        contact: ''
      },
      isPublishing: false,
      uploadProgress: 0,
      uploadingText: '准备中...',
      tabBarItems: [
        { pagePath: '/pages/index/index', text: '首页', icon: '🏠' },
        { pagePath: '/pages/message/index', text: '消息', icon: '💬' },
        { pagePath: '/pages/item/publish', text: '发布', icon: '+' },
        { pagePath: '/pages/user/index', text: '我的', icon: '👤' }
      ],
      currentTabBarIndex: 2,
      unreadTotal: 0,
      pollTimer: null,
      statusBarHeight: 0
    }
  },
  onLoad() {
    this.getStatusBarHeight()
  },
  onShow() {
    const user = storage.getUser()
    if (user && user.phone) {
      this.form.contact = user.phone
    }
    this.currentTabBarIndex = 2
    this.checkLoginAndLoadUnread()
    this.startPoll()
  },
  onHide() {
    this.stopPoll()
  },
  computed: {
    canSubmit() {
      return this.form.title && this.form.description && this.form.images.length > 0 && this.form.contact
    }
  },
  methods: {
    getStatusBarHeight() {
      try {
        const systemInfo = uni.getSystemInfoSync()
        this.statusBarHeight = systemInfo.statusBarHeight || 0
      } catch (e) {
        this.statusBarHeight = 0
      }
    },
    checkLoginAndLoadUnread() {
      const token = storage.getToken()
      if (token) {
        this.loadUnreadCount()
      } else {
        this.unreadTotal = 0
      }
    },
    async loadUnreadCount() {
      try {
        const res = await api.getMessages()
        const total = res.data.reduce((s, c) => s + (c.unread || 0), 0)
        this.unreadTotal = total
      } catch (e) {
        // 静默失败
      }
    },
    startPoll() {
      this.stopPoll()
      this.pollTimer = setInterval(() => {
        const token = storage.getToken()
        if (token) {
          this.loadUnreadCount()
        }
      }, 3000)
    },
    stopPoll() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },
    chooseImage() {
      uni.showActionSheet({
        itemList: ['拍照', '从相册选择'],
        success: (res) => {
          const sourceType = res.tapIndex === 0 ? ['camera'] : ['album']
          uni.chooseImage({
            count: 9 - this.form.images.length,
            sizeType: ['compressed'],
            sourceType: sourceType,
            success: (res) => {
              this.form.images = [...this.form.images, ...res.tempFilePaths]
            },
            fail: (err) => {
              console.error(err)
            }
          })
        }
      })
    },
    removeImage(index) {
      this.form.images.splice(index, 1)
    },
    async handleSubmit() {
      const user = storage.getUser()
      if (!user) {
        uni.showModal({
          title: '提示',
          content: '请先登录后再发布物品',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              uni.navigateTo({ url: '/pages/auth/login' })
            }
          }
        })
        return
      }
      
      if (!this.canSubmit || this.isPublishing) return
      
      this.isPublishing = true
      this.uploadProgress = 0
      this.uploadingText = '准备中...'
      
      try {
        const imageUrls = []
        const totalImages = this.form.images.length
        console.log('开始上传图片，数量:', totalImages)
        
        for (let i = 0; i < totalImages; i++) {
          const filePath = this.form.images[i]
          this.uploadingText = `上传图片 ${i + 1}/${totalImages}`
          this.uploadProgress = Math.round((i / totalImages) * 70) // 前70%是上传图片
          
          console.log(`上传第${i + 1}张图片:`, filePath)
          try {
            const res = await api.uploadImage(filePath)
            console.log(`第${i + 1}张图片上传成功:`, res.url)
            imageUrls.push(res.url)
          } catch (uploadErr) {
            console.error(`第${i + 1}张图片上传失败:`, uploadErr)
            throw new Error(`第${i + 1}张图片上传失败`)
          }
        }
        
        console.log('所有图片上传完成，URL列表:', imageUrls)
        this.uploadingText = '提交中...'
        this.uploadProgress = 80
        
        const data = {
          type: this.form.type,
          title: this.form.title,
          description: this.form.description,
          images: imageUrls,
          contact: this.form.contact
        }
        
        console.log('提交物品数据:', data)
        
        await api.createItem(data)
        this.uploadProgress = 100
        this.uploadingText = '发布成功'
        
        uni.showToast({ title: '发布成功', icon: 'success' })
        
        setTimeout(() => {
          this.isPublishing = false
          uni.reLaunch({ url: '/pages/index/index' })
        }, 1000)
      } catch (err) {
        this.isPublishing = false
        console.error('发布失败:', err)
        uni.showToast({ title: err.message || '发布失败', icon: 'none' })
      }
    },
    switchTab(index) {
      if (index !== this.currentTabBarIndex) {
        this.currentTabBarIndex = index
        uni.reLaunch({ url: this.tabBarItems[index].pagePath })
      }
    },
    handleTabClick(index) {
      this.switchTab(index)
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 200rpx;
}

.header {
  padding: 30rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.form {
  margin: 20rpx;
  background: #fff;
  border-radius: 15rpx;
  padding: 30rpx;
}

.form-item {
  margin-bottom: 30rpx;
}

.label {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 15rpx;
  display: block;
}

.type-selector {
  display: flex;
  gap: 20rpx;
}

.type-option {
  flex: 1;
  height: 70rpx;
  border-radius: 35rpx;
  border: 2rpx solid #eee;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #666;
  transition: all 0.3s;
}

.type-option.active {
  border-color: #667eea;
  background: #f0f4ff;
  color: #667eea;
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

.textarea {
  width: 100%;
  height: 200rpx;
  border: 2rpx solid #eee;
  border-radius: 10rpx;
  padding: 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.word-count {
  font-size: 24rpx;
  color: #999;
  float: right;
  margin-top: 10rpx;
}

.image-upload {
  display: flex;
  flex-wrap: wrap;
  gap: 15rpx;
}

.image-item {
  position: relative;
  width: 200rpx;
  height: 200rpx;
}

.uploaded-image {
  width: 100%;
  height: 100%;
  border-radius: 10rpx;
}

.remove-btn {
  position: absolute;
  top: -15rpx;
  right: -15rpx;
  width: 40rpx;
  height: 40rpx;
  background: #ff4444;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}

.upload-btn {
  width: 200rpx;
  height: 200rpx;
  border: 2rpx dashed #ddd;
  border-radius: 10rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.upload-icon {
  font-size: 48rpx;
  color: #ccc;
}

.upload-text {
  font-size: 24rpx;
  color: #999;
  margin-top: 10rpx;
}

.footer {
  position: fixed;
  bottom: 140rpx;
  left: 0;
  right: 0;
  padding: 20rpx;
  background: #fff;
  border-top: 1rpx solid #eee;
  z-index: 100;
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 44rpx;
  font-size: 32rpx;
}

.submit-btn[disabled] {
  opacity: 0.5;
}

.publishing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  width: 100%;
}

.uploading-text {
  font-size: 28rpx;
}

.progress-bar {
  width: 80%;
  height: 6rpx;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3rpx;
  overflow: hidden;
}

.progress-inner {
  height: 100%;
  background: #fff;
  border-radius: 3rpx;
  transition: width 0.3s;
}

.tabbar-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 999;
}

.custom-tabbar {
  padding: 12rpx 0;
  padding-bottom: calc(12rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: 1rpx solid #e8e8e8;
}

.tab-container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 80rpx;
}

.tab-bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.tab-icon {
  font-size: 40rpx;
}

.tab-text {
  font-size: 24rpx;
  color: #999999;
  margin-top: 4rpx;
}

.tab-bar-item.active .tab-icon,
.tab-bar-item.active .tab-text {
  color: #667eea;
}

/* 消息角标 */
.tab-badge {
  position: absolute;
  top: -8rpx;
  right: 50%;
  transform: translateX(50rpx);
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  background: #ff4757;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  
  text {
    font-size: 20rpx;
    color: #fff;
    line-height: 1;
  }
}
</style>