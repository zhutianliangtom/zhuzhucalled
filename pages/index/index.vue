<template>
  <view class="container" :class="{ 'theme-dark': isDark }">
    <!-- 断网提示条 -->
    <offline-banner />

    <!-- 首次使用引导 -->
    <guide-modal ref="guideModal" />
    
    <!-- 固定的头部区域 -->
    <view class="fixed-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header">
        <view class="search-bar" @click="showSearch = true">
          <text class="search-icon">🔍</text>
          <text class="search-placeholder">{{ searchKeyword || '搜索丢失物品...' }}</text>
        </view>
      </view>

      <view class="tabs">
        <view 
          v-for="tab in categoryTabs" 
          :key="tab.value"
          class="tab-item" 
          :class="{ active: activeTab === tab.value }"
          @click="handleTabChange(tab.value)"
        >
          <text>{{ tab.label }}</text>
        </view>
      </view>
      
      <!-- 时间筛选 -->
      <view class="time-filter">
        <view 
          v-for="filter in timeFilters" 
          :key="filter.value"
          class="time-filter-item" 
          :class="{ active: activeTimeFilter === filter.value }"
          @click="handleTimeFilterChange(filter.value)"
        >
          <text>{{ filter.label }}</text>
        </view>
      </view>
    </view>

    <view class="content" :style="{ marginTop: (statusBarHeight + 200) + 'px' }">
      <view v-if="items.length === 0" class="empty">
        <text class="empty-icon">📦</text>
        <text class="empty-text">暂无相关物品</text>
      </view>
      
      <view v-else class="item-list">
        <view 
          v-for="item in items" 
          :key="item.id" 
          class="item-card"
          @click="goDetail(item.id)"
        >
          <!-- 图片区域 -->
          <view v-if="item.images && item.images.length > 0" class="image-wrapper">
            <!-- 单张图片 -->
            <image 
              v-if="item.images.length === 1"
              :src="getFullImageUrl(item.images[0])" 
              mode="aspectFill" 
              class="item-image-single"
            />
            <!-- 多张图片 -->
            <view v-else class="image-container-multiple">
              <image 
                v-for="(img, idx) in item.images.slice(0, 3)" 
                :key="idx" 
                :src="getFullImageUrl(img)" 
                mode="aspectFill" 
                class="item-image-multiple"
              />
              <!-- 如果超过3张，显示数量提示 -->
              <view v-if="item.images.length > 3" class="image-count">
                <text>+{{ item.images.length - 3 }}</text>
              </view>
            </view>
          </view>
          <!-- 没有图片时显示默认图 -->
          <view v-else class="image-wrapper">
            <image :src="'https://neeko-copilot.bytedance.net/api/text-to-image?prompt=lost%20and%20found%20item&image-size=square'" mode="aspectFill" class="item-image default-image" />
          </view>
          
          <!-- 信息区域 -->
          <view class="item-info">
            <view class="item-header">
              <text class="item-title">{{ item.title }}</text>
              <text class="item-tag" :class="item.type">{{ item.type === 'lost' ? '寻物' : '招领' }}</text>
            </view>
            <text class="item-desc">{{ item.description }}</text>
            <view class="item-footer">
              <text class="item-time">{{ format.formatTime(item.createdAt * 1000) }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="showSearch" class="search-modal" @click="showSearch = false">
      <view class="search-content" :style="{ paddingTop: (statusBarHeight + 30) + 'px' }" @click.stop>
        <view class="search-input-wrap">
          <text class="search-icon">🔍</text>
          <input 
            v-model="searchKeyword" 
            type="text" 
            placeholder="输入关键词搜索..." 
            class="search-input"
            :focus="showSearch"
            confirm-type="search"
            @confirm="handleSearch"
          />
          <text v-if="searchKeyword" class="clear-btn" @click="searchKeyword = ''">✕</text>
        </view>
        
        <view class="search-tags">
          <text class="tags-title">热门搜索</text>
          <view class="tags-wrap">
            <text 
              v-for="tag in hotTags" 
              :key="tag" 
              class="tag"
              @click="searchKeyword = tag; handleSearch()"
            >{{ tag }}</text>
          </view>
        </view>
      </view>
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
import { format } from '@/utils/format'
import { storage } from '@/utils/storage'
import { cache } from '@/utils/cache'
import OfflineBanner from '@/components/OfflineBanner.vue'
import GuideModal from '@/components/GuideModal.vue'

export default {
  components: {
    OfflineBanner,
    GuideModal
  },
  data() {
    return {
      format,
      isDark: false,
      items: [],
      activeTab: 'all',
      categoryTabs: [
        { label: '全部', value: 'all' },
        { label: '寻物启事', value: 'lost' },
        { label: '失物招领', value: 'found' }
      ],
      activeTimeFilter: 'all',
      timeFilters: [
        { label: '全部', value: 'all' },
        { label: '今天', value: 'day' },
        { label: '本周', value: 'week' },
        { label: '本月', value: 'month' }
      ],
      searchKeyword: '',
      showSearch: false,
      hotTags: ['手机', '校园卡', '钥匙', '钱包', '书本'],
      page: 1,
      pageSize: 10,
      loading: false,
      
      tabBarItems: [
        { pagePath: '/pages/index/index', text: '首页', icon: '🏠' },
        { pagePath: '/pages/message/index', text: '消息', icon: '💬' },
        { pagePath: '/pages/item/publish', text: '发布', icon: '+' },
        { pagePath: '/pages/user/index', text: '我的', icon: '👤' }
      ],
      currentTabBarIndex: 0,
      unreadTotal: 0,
      pollTimer: null,
      statusBarHeight: 0
    }
  },
  onLoad() {
    this.getStatusBarHeight()
    this.loadItems()
    this.applyTheme()
    this.$nextTick(() => {
      this.checkShowGuide()
    })
    
    // 监听主题切换
    uni.$on('theme-change', ({ isDark }) => {
      this.isDark = isDark
    })
  },
  onUnload() {
    uni.$off('theme-change')
  },
  onShow() {
    this.currentTabBarIndex = 0
    // 只有登录状态下才加载未读数
    this.checkLoginAndLoadUnread()
    this.startPoll()
  },
  onHide() {
    // 不停止轮询：后台继续检测未读数
  },
  methods: {
    applyTheme() {
      const settings = storage.getSettings() || {}
      this.isDark = settings.theme === 'dark'
    },
    checkShowGuide() {
      const settings = storage.getSettings() || {}
      if (!settings.guide_shown) {
        this.$refs.guideModal.show()
      }
    },
    getStatusBarHeight() {
      try {
        const systemInfo = uni.getSystemInfoSync()
        this.statusBarHeight = systemInfo.statusBarHeight || 0
      } catch (e) {
        this.statusBarHeight = 0
      }
    },
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
    async loadItems() {
      if (this.loading) return
      this.loading = true

      const cacheKey = `items_${this.activeTab}_${this.activeTimeFilter}_${this.searchKeyword}_${this.page}`

      try {
        const params = {
          page: this.page,
          pageSize: this.pageSize
        }
        if (this.activeTab && this.activeTab !== 'all') params.type = this.activeTab
        if (this.activeTimeFilter && this.activeTimeFilter !== 'all') params.timeRange = this.activeTimeFilter
        if (this.searchKeyword && this.searchKeyword.trim()) params.keyword = this.searchKeyword.trim()

        await cache.fetch(cacheKey, () => api.getItems(params), {
          ttl: cache.TTL.items,
          onLoad: (cached) => {
            // 秒显缓存数据
            if (cached && cached.data && cached.data.length > 0) {
              this.items = cached.data
            }
          },
          onRefresh: (fresh) => {
            // 后台刷新拿到新数据
            if (fresh && fresh.data && fresh.data.length > 0) {
              this.items = fresh.data
            } else {
              this.items = []
            }
          }
        })
      } catch (err) {
        console.error('[首页] 加载失败:', err)
        if (this.items.length === 0) this.items = []
      } finally {
        this.loading = false
      }
    },
    handleTabChange(value) {
      this.activeTab = value
      this.page = 1
      this.items = []
      this.loadItems()
    },
    handleTimeFilterChange(value) {
      this.activeTimeFilter = value
      this.page = 1
      this.items = []
      this.loadItems()
    },
    handleSearch() {
      this.page = 1
      this.items = []
      this.showSearch = false
      this.loadItems()
    },
    goDetail(id) {
      uni.navigateTo({ url: `/pages/item/detail?id=${id}` })
    },
    onReachBottom() {
      if (!this.loading) {
        this.page++
        this.loadItems()
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
    },
    // 检查登录状态并加载未读数
    checkLoginAndLoadUnread() {
      const token = storage.getToken()
      if (token) {
        this.loadUnreadCount()
      } else {
        // 未登录状态下不显示角标
        this.unreadTotal = 0
      }
    },
    // 加载未读数
    async loadUnreadCount() {
      try {
        const res = await api.getMessages()
        const total = res.data.reduce((s, c) => s + (parseInt(c.unread) || 0), 0)
        this.unreadTotal = total
      } catch (err) {
        // 静默失败，不打印错误（避免未登录时刷屏）
        if (err.message !== '登录已过期') {
          console.error('获取未读数失败:', err)
        }
      }
    },
    // 轮询未读数
    startPoll() {
      this.stopPoll()
      this.pollTimer = setInterval(() => {
        // 只有登录状态下才轮询
        const token = storage.getToken()
        if (token) {
          this.loadUnreadCount()
        }
      }, 15000) // 15秒轮询一次，避免请求过于频繁
    },
    stopPoll() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-top: 0;
  padding-bottom: 120rpx;
}

/* 固定的头部区域 */
.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: linear-gradient(135deg, #4f8cff 0%, #6c63ff 100%);
}

.header {
  padding: 20rpx;
}

.search-bar {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.95) !important;
  border-radius: 40rpx;
  padding: 20rpx 30rpx;
}

.search-icon {
  font-size: 32rpx;
  margin-right: 15rpx;
}

.search-placeholder {
  font-size: 28rpx;
  color: #666 !important;
}

.theme-dark .search-bar {
  background: rgba(26, 26, 46, 0.95) !important;
}

.theme-dark .search-placeholder {
  color: #999 !important;
}

/* 分类tabs */
.tabs {
  display: flex;
  background: #ffffff;
  padding: 20rpx;
  border-bottom: 1rpx solid #eee;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 15rpx 0;
  font-size: 28rpx;
  color: #999;
  border-radius: 30rpx;
  transition: all 0.3s;
}

.tab-item.active {
  background: #4f8cff;
  color: #fff;
}

/* 时间筛选 */
.time-filter {
  display: flex;
  background: #ffffff;
  padding: 15rpx 20rpx;
  border-bottom: 1rpx solid #eee;
  gap: 15rpx;
}

.time-filter-item {
  padding: 8rpx 20rpx;
  font-size: 24rpx;
  color: #999;
  border-radius: 20rpx;
  background: #f5f5f5;
  transition: all 0.3s;
}

.time-filter-item.active {
  background: #4f8cff;
  color: #fff;
}

/* 内容区域 - 留出固定头部的空间 */
.content {
  padding: 20rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0 20rpx 20rpx;
}

.item-card {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
  margin-bottom: 20rpx;
}

/* 图片区域 */
.image-wrapper {
  width: 100%;
  background: #f5f5f5;
}

/* 单张图片 */
.item-image-single {
  width: 100%;
  height: 360rpx;
  display: block;
}

/* 多张图片容器 */
.image-container-multiple {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 4rpx;
  padding: 0;
}

.item-image-multiple {
  flex: 1;
  min-width: 0;
  height: 360rpx;
  display: block;
}

/* 默认图片 */
.item-image.default-image {
  width: 100%;
  height: 360rpx;
}

/* 图片数量提示 */
.image-count {
  position: absolute;
  bottom: 16rpx;
  right: 16rpx;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  padding: 6rpx 16rpx;
  border-radius: 24rpx;
  font-size: 22rpx;
  font-weight: 500;
}

.item-info {
  padding: 24rpx 28rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.item-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
}

.item-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
  word-break: break-all;
}

.item-desc {
  font-size: 26rpx;
  color: #7f8c8d;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.6;
}

.item-footer {
  display: flex;
  align-items: center;
  margin-top: 4rpx;
}

.item-time {
  font-size: 22rpx;
  color: #bdc3c7;
}

.item-tag {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.item-tag.lost {
  background: #fff3e0;
  color: #ff9800;
}

.item-tag.found {
  background: #e3f2fd;
  color: #1976d2;
}

.search-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.search-content {
  background: #ffffff;
  padding: 30rpx;
}

.theme-dark .search-content {
  background: #1a1a2e;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 40rpx;
  padding: 20rpx 30rpx;
  margin-bottom: 30rpx;
}

.theme-dark .search-input-wrap {
  background: rgba(26, 26, 46, 0.95);
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  margin-left: 15rpx;
  color: #333;
}

.theme-dark .search-input {
  color: #e0e0e0;
}

.clear-btn {
  font-size: 28rpx;
  color: #999;
  padding: 10rpx;
}

.search-tags {
  margin-top: 20rpx;
}

.tags-title {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 15rpx;
  display: block;
}

.theme-dark .tags-title {
  color: #999;
}

.tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 15rpx;
}

.tag {
  font-size: 26rpx;
  padding: 10rpx 25rpx;
  background: #f5f5f5;
  border-radius: 30rpx;
  color: #666;
}

.theme-dark .tag {
  background: #2a2a3e;
  color: #999;
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
  border-top: 1rpx solid #eee;
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
  position: relative;
}

.tab-icon {
  font-size: 40rpx;
}

.tab-text {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
}

.tab-bar-item.active .tab-icon,
.tab-bar-item.active .tab-text {
  color: #4f8cff;
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