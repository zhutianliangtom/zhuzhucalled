<template>
  <view class="container">
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text>‹</text>
      </view>
      <view class="user-info">
        <view class="avatar">
          <image v-if="userAvatar" :src="getFullImageUrl(userAvatar)" mode="aspectFill" class="avatar-img" />
          <text v-else>{{ (userName || '?').charAt(0) }}</text>
        </view>
        <text class="user-name">{{ userName }}</text>
      </view>
      <view class="more-btn" @click="showMoreOptions">
        <text>⋯</text>
      </view>
    </view>
    
    <scroll-view 
      id="msgScroll" 
      class="message-list" 
      scroll-y 
      scroll-with-animation 
      :scroll-into-view="scrollToId"
      @scrolltolower="loadMore"
    >
      <view 
        v-for="(msg, index) in messages" 
        :key="msg.id"
        :id="'msg-' + index"
        :class="['message-item', msg.senderId === currentUserId ? 'self' : 'other']"
      >
        <!-- 对方头像 -->
        <view class="avatar msg-avatar" v-if="msg.senderId !== currentUserId">
          <image v-if="msg.senderAvatar" :src="getFullImageUrl(msg.senderAvatar)" mode="aspectFill" class="avatar-img" />
          <text v-else>{{ (msg.senderName || '?').charAt(0) }}</text>
        </view>

        <view class="message-content" @longpress="onLongPress(msg)">

          <!-- 文字消息 -->
          <view v-if="msg.type === 'text'" class="text-message">
            <text>{{ msg.content }}</text>
          </view>

          <!-- 图片消息 -->
          <view v-else-if="msg.type === 'image'" class="media-message image-message">
            <image
              :src="getMediaUrl(msg.mediaUrl)"
              mode="widthFix"
              class="media-img"
              @click="previewImage(msg.mediaUrl)"
            />
            <view class="media-tag">
              <text>[图片]</text>
            </view>
          </view>

          <!-- 视频消息 -->
          <view v-else-if="msg.type === 'video'" class="media-message video-message" @click="playVideo(msg.mediaUrl)">
            <image
              :src="getMediaUrl(msg.mediaUrl, 'video')"
              mode="aspectFill"
              class="video-thumb"
            />
            <view class="video-play-overlay">
              <view class="video-play-icon">
                <text>▶</text>
              </view>
            </view>
            <view class="media-tag">
              <text>[视频]</text>
            </view>
          </view>

          <!-- 已撤回提示 -->
          <view v-else-if="msg.type === 'recalled'" class="recalled-message">
            <text>{{ msg.senderId === currentUserId ? '你撤回了一条消息' : '对方撤回了一条消息' }}</text>
          </view>

          <text class="message-time">{{ formatMessageTime(msg.createdAt) }}</text>
        </view>

        <!-- 自己头像 -->
        <view class="avatar msg-avatar" v-if="msg.senderId === currentUserId">
          <image v-if="currentUserAvatar" :src="getFullImageUrl(currentUserAvatar)" mode="aspectFill" class="avatar-img" />
          <text v-else>{{ currentUserName?.charAt(0) || '?' }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 一键回底按钮 -->
    <view v-if="showScrollBtn" class="scroll-bottom-btn" @click="scrollToBottom">
      <text class="scroll-icon">⬇</text>
      <text v-if="newMsgCount > 0" class="scroll-count">{{ newMsgCount }}</text>
    </view>
    
    <view class="input-area">
      <view class="input-tools">
        <view class="tool-btn" @click="chooseImage">
          <text>📷</text>
        </view>
        <view class="tool-btn" @click="chooseVideo">
          <text>🎬</text>
        </view>
      </view>
      <view class="input-wrapper">
        <input 
          v-model="inputText" 
          class="message-input" 
          placeholder="输入消息..." 
          @confirm="sendMessage"
        />
        <button class="send-btn" :disabled="!inputText.trim()" @click="sendMessage">
          <text>发送</text>
        </button>
      </view>
    </view>

    <!-- 长按操作菜单 -->
    <view v-if="contextMenu.show" class="context-menu-mask" @click="closeContextMenu">
      <view class="context-menu" :style="contextMenuStyle" @click.stop>
        <view
          v-for="item in contextMenu.actions"
          :key="item.key"
          class="context-menu-item"
          :class="item.danger ? 'danger' : ''"
          @click="handleContextAction(item.key)"
        >
          <text class="menu-icon">{{ item.icon }}</text>
          <text class="menu-label">{{ item.label }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { format } from '@/utils/format'
import { storage } from '@/utils/storage'
import { cache } from '@/utils/cache'
import { simpleImageCache } from '@/utils/simpleImageCache'

export default {
  data() {
    return {
      format,
      userId: '',
      userName: '',
      userAvatar: '', // 对方头像
      currentUserId: '',
      currentUserName: '',
      currentUserAvatar: '', // 自己头像
      messages: [],
      inputText: '',
      scrollTop: 0,
      pollTimer: null,
      showScrollBtn: false,
      newMsgCount: 0,
      scrollToId: '', // 用于scroll-into-view
      contextMenu: {
        show: false,
        msg: null,
        actions: [],
        y: 0,
        x: 0
      },
      mediaCacheMap: {} // 媒体URL缓存映射
    }
  },
  computed: {
    contextMenuStyle() {
      const sysInfo = uni.getSystemInfoSync()
      const menuW = 160  // 菜单宽度估计值 px
      const x = Math.min(this.contextMenu.x, sysInfo.windowWidth - menuW - 8)
      const safeX = Math.max(x, 8)
      return `top: ${this.contextMenu.y}px; left: ${safeX}px;`
    }
  },
  onLoad(options) {
    if (options?.userId) {
      this.userId = options.userId
      this.userName = decodeURIComponent(options.userName || '未知用户')
      this.userAvatar = options.userAvatar || ''
    }
    
    const user = storage.getUser()
    if (user) {
      this.currentUserId = user.id
      this.currentUserName = user.name
      this.currentUserAvatar = user.avatar || ''
    }
    
    this.loadMessages()
    this.startPoll()
  },
  onShow() {
    this.loadMessages()
    // 进入聊天页面时立即标记该对话为已读
    this.markAsRead()
  },
  onHide() {
    this.stopPoll()
  },
  onUnload() {
    this.stopPoll()
    // 退出聊天时清除该对话的未读角标
    this.clearUnreadBadge()
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
    /**
     * 获取媒体URL（优先使用缓存）
     * @param {string} url - 媒体URL
     * @param {string} type - 媒体类型 ('image' | 'video')
     */
    getMediaUrl(url, type = 'image') {
      if (!url) return ''
      
      // 获取完整URL
      const fullUrl = this.getFullImageUrl(url)
      
      // 如果是本地路径或已经是缓存路径，直接返回
      if (fullUrl.startsWith('file://') || fullUrl.startsWith('/') || fullUrl.startsWith('_doc/')) {
        return fullUrl
      }
      
      // 检查缓存映射
      if (this.mediaCacheMap[fullUrl]) {
        return this.mediaCacheMap[fullUrl]
      }
      
      // 如果是视频类型的URL，检查是否是视频格式
      if (type === 'video') {
        const lowerUrl = fullUrl.toLowerCase()
        // 如果URL是视频格式但还没有缩略图，使用默认图标
        if (lowerUrl.includes('.mp4') || lowerUrl.includes('.mov') || 
            lowerUrl.includes('.avi') || lowerUrl.includes('.mkv') || 
            lowerUrl.includes('.webm') || lowerUrl.includes('.3gp')) {
          // 返回视频播放图标（使用 base64 或占位图）
          return this._getVideoPlaceholder()
        }
      }
      
      // 返回原始URL（异步缓存会在后台进行）
      // 启动后台缓存
      if (!this._cachingUrls?.has(fullUrl)) {
        this._startMediaCache(fullUrl)
      }
      
      return fullUrl
    },
    /**
     * 获取视频占位图
     */
    _getVideoPlaceholder() {
      // 返回一个视频播放图标的 base64 图片
      return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBmaWxsPSIjMzM0MTU1IiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIvPjxwYXRoIGQ9Ik02MCA0MEw0OCAxMDBMNDIgMTAwIi8+PC9zdmc+'
    },
    /**
     * 后台启动媒体缓存
     */
    _startMediaCache(url) {
      if (!url || this._cachingUrls?.has(url)) return
      
      if (!this._cachingUrls) {
        this._cachingUrls = new Set()
      }
      this._cachingUrls.add(url)
      
      simpleImageCache.get(url).then(cachedPath => {
        this._cachingUrls?.delete(url)
        if (cachedPath && cachedPath !== url) {
          this.$set(this.mediaCacheMap, url, cachedPath)
        }
      }).catch(() => {
        this._cachingUrls?.delete(url)
      })
    },
    /**
     * 获取带缓存的媒体URL（用于图片和视频缩略图）
     */
    async getCachedMediaUrl(url) {
      if (!url) return ''
      
      // 获取完整URL
      const fullUrl = this.getFullImageUrl(url)
      
      // 如果是本地路径或已经是缓存路径，直接返回
      if (fullUrl.startsWith('file://') || fullUrl.startsWith('/') || fullUrl.startsWith('_doc/')) {
        return fullUrl
      }
      
      // 检查是否已有缓存
      if (this.mediaCacheMap[fullUrl]) {
        return this.mediaCacheMap[fullUrl]
      }
      
      // 如果URL以 http:// 或 https:// 开头，尝试缓存
      if (fullUrl.startsWith('http')) {
        try {
          // 先返回原始URL，同时异步缓存
          this.$set(this.mediaCacheMap, fullUrl, fullUrl)
          
          // 异步下载并缓存
          const cachedPath = await simpleImageCache.get(fullUrl)
          if (cachedPath && cachedPath !== fullUrl) {
            this.$set(this.mediaCacheMap, fullUrl, cachedPath)
          }
        } catch (e) {}
      }
      
      return fullUrl
    },
    /**
     * 预加载消息中的所有媒体（图片和视频缩略图）
     */
    async preloadMedia(messages) {
      if (!messages || messages.length === 0) return
      
      const mediaUrls = []
      messages.forEach(msg => {
        if (msg.type === 'image' && msg.mediaUrl) {
          mediaUrls.push(this.getFullImageUrl(msg.mediaUrl))
        } else if (msg.type === 'video' && msg.mediaUrl) {
          mediaUrls.push(this.getFullImageUrl(msg.mediaUrl))
        }
      })
      
      if (mediaUrls.length > 0) {
        // 批量预加载媒体
        for (const url of mediaUrls) {
          if (!this.mediaCacheMap[url]) {
            this.$set(this.mediaCacheMap, url, url)
            simpleImageCache.get(url).then(cachedPath => {
              if (cachedPath && cachedPath !== url) {
                this.$set(this.mediaCacheMap, url, cachedPath)
              }
            }).catch(() => {})
          }
        }
      }
    },
    formatMessageTime(timestamp) {
      // 将毫秒时间戳格式化为 HH:mm
      const date = new Date(timestamp)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    },
    startPoll() {
      this.stopPoll()
      this.pollTimer = setInterval(() => {
        this.loadMessages(true) // 静默刷新
      }, 3000)
    },
    stopPoll() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },
    scrollToBottom() {
      this.showScrollBtn = false
      this.newMsgCount = 0
      this.$nextTick(() => {
        const lastIndex = this.messages.length - 1
        if (lastIndex >= 0) {
          // 使用scroll-into-view滚动到最后一条
          this.scrollToId = `msg-${lastIndex}`
          // 清除scrollToId，防止下次不滚动
          setTimeout(() => {
            this.scrollToId = ''
          }, 500)
        }
      })
    },
    goBack() {
      uni.navigateBack()
    },
    showMoreOptions() {
      // 获取拉黑列表判断是否已拉黑
      this.checkBlockStatus()
    },
    async checkBlockStatus() {
      try {
        const res = await api.getBlockedUsers()
        const isBlocked = res.data.some(u => u.id === this.userId)
        
        uni.showActionSheet({
          itemList: isBlocked ? ['取消拉黑'] : ['拉黑对方'],
          success: async (actionRes) => {
            if (isBlocked) {
              this.confirmUnblock()
            } else {
              this.confirmBlock()
            }
          }
        })
      } catch (err) {}
    },
    confirmBlock() {
      uni.showModal({
        title: '确认拉黑',
        content: '拉黑后将删除所有对话，对方将无法给你发送消息',
        confirmText: '拉黑',
        confirmColor: '#ff4757',
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.blockUser(this.userId)
              uni.showToast({ title: '拉黑成功', icon: 'success' })
              setTimeout(() => {
                uni.navigateBack()
              }, 1500)
            } catch (err) {
              uni.showToast({ title: '拉黑失败', icon: 'none' })
            }
          }
        }
      })
    },
    confirmUnblock() {
      uni.showModal({
        title: '取消拉黑',
        content: '取消拉黑后，对方将可以再次给你发送消息',
        confirmText: '取消拉黑',
        confirmColor: '#334155',
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.unblockUser(this.userId)
              uni.showToast({ title: '已取消拉黑', icon: 'success' })
            } catch (err) {
              uni.showToast({ title: '操作失败', icon: 'none' })
            }
          }
        }
      })
    },
    async loadMessages(silent = false) {
      const cacheKey = `conv_${this.currentUserId}_${this.userId}`
      const oldLen = this.messages.length
      
      try {
        await cache.fetch(cacheKey, () => api.getConversation(this.userId), {
          ttl: cache.TTL.conversation,
          force: silent, // 静默刷新时强制刷新
          onLoad: async (cached) => {
            // 立即显示缓存数据
            if (cached && cached.data) {
              this.messages = cached.data
              // 预加载媒体文件并等待完成（确保秒显示）
              if (!silent) {
                await this._preloadAllMediaAndWait(cached.data)
                this.scrollToBottom()
              }
            }
          },
          onRefresh: async (fresh) => {
            // 后台刷新完成后更新
            if (fresh && fresh.data) {
              this.messages = fresh.data
              // 预加载媒体文件并等待完成
              if (!silent) {
                await this._preloadAllMediaAndWait(fresh.data)
                this.newMsgCount = 0
                this.showScrollBtn = false
              } else {
                // 静默刷新：有新消息时显示回底按钮
                if (fresh.data.length > oldLen) {
                  this.newMsgCount = fresh.data.length - oldLen
                  this.showScrollBtn = true
                }
                // 静默模式下也预加载但不等待
                this._preloadAllMedia(fresh.data)
              }
            }
          }
        })
      } catch (err) {
        // 如果网络请求失败，使用缓存数据
        const cachedData = cache.getSync(cacheKey, cache.TTL.conversation)
        if (cachedData && cachedData.data) {
          this.messages = cachedData.data
          // 预加载媒体文件并等待完成
          if (!silent) {
            await this._preloadAllMediaAndWait(cachedData.data)
            this.scrollToBottom()
          }
        }
      }
    },
    /**
     * 预加载所有媒体文件（图片和视频缩略图）
     */
    _preloadAllMedia(messages) {
      if (!messages || messages.length === 0) return
      
      messages.forEach(msg => {
        if ((msg.type === 'image' || msg.type === 'video') && msg.mediaUrl) {
          const fullUrl = this.getFullImageUrl(msg.mediaUrl)
          // 如果是视频格式，跳过缩略图缓存（因为视频URL不是图片）
          if (msg.type === 'video') return
          // 如果没有缓存，启动后台缓存
          if (!this.mediaCacheMap[fullUrl] && !this._cachingUrls?.has(fullUrl)) {
            this._startMediaCache(fullUrl)
          }
        }
      })
    },
    /**
     * 预加载所有媒体文件并等待完成（确保秒显示）
     */
    async _preloadAllMediaAndWait(messages) {
      if (!messages || messages.length === 0) return
      
      const mediaPromises = []
      
      messages.forEach(msg => {
        if ((msg.type === 'image' || msg.type === 'video') && msg.mediaUrl) {
          const fullUrl = this.getFullImageUrl(msg.mediaUrl)
          
          // 如果是视频类型，跳过缩略图缓存（因为视频URL不是图片）
          if (msg.type === 'video') return
          
          // 如果已经有缓存，跳过
          if (this.mediaCacheMap[fullUrl]) return
          // 如果正在缓存中，等待它
          if (this._cachingUrls?.has(fullUrl)) {
            mediaPromises.push(this._waitForCache(fullUrl))
          } else {
            // 启动新的缓存并等待
            this._startMediaCache(fullUrl)
            // 等待一小段时间确保缓存真正开始
            setTimeout(() => {
              mediaPromises.push(this._waitForCache(fullUrl))
            }, 50)
          }
        }
      })
      
      // 等待所有媒体缓存完成
      if (mediaPromises.length > 0) {
        await Promise.all(mediaPromises)
      }
    },
    /**
     * 等待特定URL的缓存完成
     */
    _waitForCache(url) {
      return new Promise((resolve) => {
        // 最多等待3秒超时
        const timeout = setTimeout(() => {
          resolve()
        }, 3000)
        
        // 轮询检查缓存是否完成
        const checkCache = () => {
          if (this.mediaCacheMap[url]) {
            clearTimeout(timeout)
            resolve()
          } else if (!this._cachingUrls?.has(url)) {
            // 缓存已经失败或被移除，直接resolve
            clearTimeout(timeout)
            resolve()
          } else {
            setTimeout(checkCache, 50)
          }
        }
        
        // 开始检查
        checkCache()
      })
    },
    async sendMessage() {
      if (!this.inputText.trim()) return
      
      const content = this.inputText.trim()
      this.inputText = ''
      
      // 发送消息前清除缓存，确保新消息能立即显示
      const cacheKey = `conv_${this.currentUserId}_${this.userId}`
      cache.set(cacheKey, null)
      
      try {
        await api.sendMessage(this.userId, content)
        this.loadMessages()
        this.scrollToBottom()
      } catch (err) {
        uni.showToast({ title: '发送失败', icon: 'none' })
        this.inputText = content
      }
    },
    chooseImage() {
      const user = storage.getUser()
      if (!user) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      
      uni.chooseImage({
        count: 9,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const filePaths = res.tempFilePaths
          uni.showLoading({ title: '上传中...' })
          
          // 清除缓存，确保新消息能立即显示
          const cacheKey = `conv_${this.currentUserId}_${this.userId}`
          cache.set(cacheKey, null)
          
          try {
            for (let filePath of filePaths) {
              const result = await api.uploadImage(filePath)
              await api.sendMessage(this.userId, '', 'image', result.url)
            }
            uni.hideLoading()
            uni.showToast({ title: '发送成功', icon: 'success' })
            this.loadMessages()
          } catch (err) {
            uni.hideLoading()
            uni.showToast({ title: err.message || '图片发送失败', icon: 'none', duration: 3000 })
          }
        },
        fail: () => {
          uni.showToast({ title: '选择图片失败', icon: 'none' })
        }
      })
    },
    chooseVideo() {
      const user = storage.getUser()
      if (!user) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      
      uni.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        camera: 'back',
        compressed: false,
        success: async (res) => {
          const { tempFilePath, size } = res
          
          if (size > 1024 * 1024 * 1024) {
            uni.showToast({ title: '视频大小不能超过1GB', icon: 'none' })
            return
          }
          
          uni.showLoading({ title: '上传视频中...' })
          
          // 清除缓存，确保新消息能立即显示
          const cacheKey = `conv_${this.currentUserId}_${this.userId}`
          cache.set(cacheKey, null)
          
          try {
            const result = await api.uploadVideo(tempFilePath)
            await api.sendMessage(this.userId, '', 'video', result.url)
            uni.hideLoading()
            uni.showToast({ title: '发送成功', icon: 'success' })
            this.loadMessages()
          } catch (err) {
            uni.hideLoading()
            uni.showToast({ title: err.message || '视频发送失败', icon: 'none', duration: 3000 })
          }
        },
        fail: () => {
          uni.showToast({ title: '选择视频失败', icon: 'none' })
        }
      })
    },
    previewImage(url) {
      uni.previewImage({
        urls: [url],
        current: url
      })
    },
    playVideo(url) {
      uni.navigateTo({
        url: `/pages/message/video-player?url=${encodeURIComponent(url)}`
      })
    },
    loadMore() {
    },

    // 长按消息
    onLongPress(msg) {
      if (msg.type === 'recalled') return

      const actions = []
      const isMine = msg.senderId === this.currentUserId

      // 只有自己发的消息才能撤回（2分钟内）
      if (isMine) {
        const now = Date.now()
        const msgTime = new Date(msg.createdAt).getTime()
        const diff = now - msgTime
        if (diff < 2 * 60 * 1000) {
          actions.push({ key: 'recall', label: '撤回', icon: '↩', danger: true })
        } else {
          // 超过2分钟提示用户
          uni.showToast({ title: '超过2分钟，无法撤回', icon: 'none', duration: 1500 })
          if (msg.type !== 'text') return
        }
      }

      if (msg.type === 'text') {
        actions.push({ key: 'copy', label: '复制', icon: '📋' })
      }

      if (actions.length === 0) return

      // 获取点击位置
      uni.createSelectorQuery().in(this).select(`#msg-${this.messages.indexOf(msg)}`).boundingClientRect((rect) => {
        const sysInfo = uni.getSystemInfoSync()
        const menuW = 160  // 菜单估计宽度 px
        
        // 根据消息是左边还是右边来决定菜单位置
        let x
        if (isMine) {
          // 自己的消息在右边，菜单显示在左侧
          x = Math.max(rect.right - menuW - 20, 20)
        } else {
          // 对方的消息在左边，菜单显示在右侧
          x = Math.min(rect.left + 20, sysInfo.windowWidth - menuW - 20)
        }
        
        // Y轴位置：消息中间
        const y = rect.top + rect.height / 2

        this.contextMenu = {
          show: true,
          msg,
          actions,
          x,
          y
        }
      }).exec()
    },

    closeContextMenu() {
      this.contextMenu.show = false
      this.contextMenu.msg = null
    },

    async handleContextAction(key) {
      const msg = this.contextMenu.msg
      this.closeContextMenu()

      if (key === 'recall') {
        // 防重复请求
        if (this._recalling) return
        this._recalling = true
        try {
          await api.recallMessage(msg.id)
          // 本地替换为撤回状态
          const idx = this.messages.findIndex(m => m.id === msg.id)
          if (idx !== -1) {
            this.$set(this.messages, idx, { ...msg, type: 'recalled' })
          }
          uni.showToast({ title: '已撤回', icon: 'success' })
        } catch (err) {
          uni.showToast({ title: err.message || '撤回失败', icon: 'none' })
        } finally {
          this._recalling = false
        }
      } else if (key === 'copy') {
        uni.setClipboardData({
          data: msg.content,
          success: () => {
            uni.showToast({ title: '已复制', icon: 'success' })
          }
        })
      }
    },
    // 标记当前对话为已读
    async markAsRead() {
      try {
        await api.markConversationRead(this.userId)
      } catch (err) {}
    },
    // 清除当前对话的未读角标（退出时调用）
    async clearUnreadBadge() {
      try {
        // 再次确保标记为已读（防止onShow时失败）
        await api.markConversationRead(this.userId)
      } catch (err) {
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f2f5;
  overflow: hidden;
}

/* ─── Header ─── */
.header {
  display: flex;
  align-items: center;
  padding: 60rpx 30rpx 30rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #eee;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  text { font-size: 48rpx; color: #333; }
}

.more-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  text { font-size: 40rpx; color: #999; }
}

.user-info {
  display: flex;
  align-items: center;
}

.avatar {
  width: 72rpx;
  height: 72rpx;
  background: #334155;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  text {
    font-size: 30rpx;
    color: #fff;
    font-weight: bold;
  }
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.user-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-left: 16rpx;
}

/* ─── Message List ─── */
.message-list {
  flex: 1;
  padding: 20rpx 16rpx;
  overflow: hidden;
  box-sizing: border-box;
}

.message-item {
  display: flex;
  align-items: flex-end;
  margin-bottom: 32rpx;
  width: 100%;
  box-sizing: border-box;
  padding: 0 4rpx;
}

.message-item.self {
  flex-direction: row-reverse;
}

.msg-avatar {
  width: 72rpx;
  height: 72rpx;
  flex-shrink: 0;
}

.message-item.other .msg-avatar {
  margin-right: 16rpx;
}

.message-item.self .msg-avatar {
  margin-left: 16rpx;
}

/* ─── Message Content ─ */
.message-content {
  max-width: 75%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-right: 4rpx;
  width: auto;
  flex-shrink: 0;
}

.message-item.other .message-content {
  align-items: flex-start;
  margin-right: 0;
  margin-left: 4rpx;
}

/* 媒体消息不参与flex对齐，自适应宽度 */
.media-message {
  align-self: flex-end; /* 自己的消息靠右 */
  width: auto; /* 媒体消息按自身宽度显示 */
  max-width: 100%; /* 不超过父容器 */
}

.message-item.other .media-message {
  align-self: flex-start; /* 对方的消息靠左 */
}

/* ── Text Message ─── */
.text-message {
  background: #334155;
  color: #fff;
  padding: 20rpx 25rpx;
  border-radius: 24rpx 8rpx 24rpx 24rpx;
  font-size: 28rpx;
  line-height: 1.6;
  display: inline-block;
  word-break: break-all;
}

.message-item.other .text-message {
  background: #ffffff;
  color: #333;
  border-radius: 8rpx 24rpx 24rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

/* ── Media Message (图片 + 视频公用) ── */
.media-message {
  border-radius: 16rpx;
  overflow: hidden;
  min-width: 300rpx;
  max-width: 560rpx;
  min-height: 200rpx;
  background: #1a1a1a;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.12);
  position: relative;
}

.media-img {
  width: 100%;
  height: auto; /* 高度自适应，保持原始比例 */
  display: block;
}

/* 视频缩略图样式 */
.video-thumb {
  width: 100%;
  height: 360rpx;
  display: block;
  background: #1a1a1a;
}

/* 视频播放按钮覆盖层 */
.video-play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
}

.video-play-icon {
  width: 100rpx;
  height: 100rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.3);
  
  text {
    font-size: 40rpx;
    color: #334155;
    margin-left: 6rpx;
  }
}

/* 自己发的媒体消息：渐变边框效果 */
.message-item.self .media-message {
  border: 3rpx solid rgba(102, 126, 234, 0.4);
}

/* 对方发的媒体消息 */
.message-item.other .media-message {
  border: 3rpx solid rgba(255,255,255,0.8);
}

/* ─── Video Overlay ─── */
.video-message {
  position: relative;
  /* 视频消息独立宽度控制 */
  width: auto !important;
  max-width: 560rpx;
}

.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
}

.play-btn {
  width: 88rpx;
  height: 88rpx;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid rgba(255,255,255,0.7);
}

.play-icon {
  color: #fff;
  font-size: 34rpx;
  margin-left: 6rpx; /* 视觉居中 */
}

/* ─── Media Tag ─── */
.media-tag {
  position: absolute;
  bottom: 8rpx;
  right: 8rpx;
  background: rgba(0, 0, 0, 0.6);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  text {
    font-size: 20rpx;
    color: #fff;
  }
}

.image-message, .video-message {
  position: relative;
}

/* ─── Recalled ─── */
.recalled-message {
  padding: 14rpx 24rpx;
  background: #e8e8e8;
  border-radius: 20rpx;
  text {
    font-size: 24rpx;
    color: #999;
    font-style: italic;
  }
}

/* ─── Time ─── */
.message-time {
  font-size: 22rpx;
  color: #aaa;
  margin-top: 8rpx;
}

.message-item.self .message-time {
  text-align: right;
}

/* ─── Input Area ─── */
.input-area {
  background: #ffffff;
  padding: 20rpx 20rpx calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #eee;
  flex-shrink: 0;
}

.input-tools {
  display: flex;
  gap: 30rpx;
  margin-bottom: 15rpx;
}

.tool-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: #f8f9fa;
  border-radius: 40rpx;
  padding: 0 20rpx;
}

.message-input {
  flex: 1;
  height: 80rpx;
  font-size: 28rpx;
}

.send-btn {
  background: #334155;
  color: #fff;
  border-radius: 30rpx;
  padding: 15rpx 30rpx;
  font-size: 28rpx;
  &[disabled] { opacity: 0.5; }
}

/* ─── Context Menu ─── */
.context-menu-mask {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: transparent;
}

.context-menu {
  position: absolute;
  background: #ffffff;
  border-radius: 16rpx;
  box-shadow: 0 8rpx 40rpx rgba(0,0,0,0.18);
  overflow: hidden;
  min-width: 180rpx;
  z-index: 1000;
  animation: menuIn 0.15s ease;
}

@keyframes menuIn {
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
}

.context-menu-item {
  display: flex;
  align-items: center;
  padding: 28rpx 36rpx;
  border-bottom: 1rpx solid #eee;
  &:last-child { border-bottom: none; }
  &:active { background: #f8f9fa; }

  .menu-icon {
    font-size: 32rpx;
    margin-right: 16rpx;
  }
  .menu-label {
    font-size: 28rpx;
    color: #333;
  }

  &.danger .menu-label {
    color: #ff4757;
  }
}

/* ─── 一键回底按钮 ─── */
.scroll-bottom-btn {
  position: fixed;
  right: 30rpx;
  bottom: 260rpx;
  width: 80rpx;
  height: 80rpx;
  background: #ffffff;
  border-radius: 50%;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  &:active { transform: scale(0.92); }
}

.scroll-icon {
  font-size: 32rpx;
  color: #334155;
}

.scroll-count {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  background: #ff4757;
  color: #fff;
  font-size: 18rpx;
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  text-align: center;
  border-radius: 20rpx;
  padding: 0 8rpx;
}
</style>
