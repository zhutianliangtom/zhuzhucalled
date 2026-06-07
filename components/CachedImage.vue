<template>
  <image 
    :src="displayUrl" 
    :mode="mode" 
    :class="['cached-image', className]"
    @load="handleLoad"
    @error="handleError"
  />
</template>

<script>
import { imageCache } from '@/utils/imageCache'

export default {
  name: 'CachedImage',
  props: {
    src: {
      type: String,
      default: ''
    },
    mode: {
      type: String,
      default: 'aspectFill'
    },
    className: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      displayUrl: '',
      hasCache: false
    }
  },
  watch: {
    src: {
      immediate: true,
      handler(newSrc) {
        this.loadImage(newSrc)
      }
    }
  },
  mounted() {
    if (this.src) {
      this.loadImage(this.src)
    }
  },
  methods: {
    async loadImage(url) {
      if (!url) {
        this.displayUrl = ''
        return
      }

      // 先尝试获取缓存
      const cachedUrl = imageCache.getCachedUrl(url)
      
      if (cachedUrl) {
        // 有缓存，直接使用缓存路径
        this.displayUrl = cachedUrl
        this.hasCache = true
        console.log('[CachedImage] 使用缓存:', url)
      } else {
        // 没有缓存，先用原始URL显示，后台下载缓存
        this.displayUrl = url
        this.hasCache = false
        
        // 后台异步下载缓存
        this.cacheImageAsync(url)
      }
    },

    async cacheImageAsync(url) {
      try {
        const cachedPath = await imageCache.getImage(url)
        if (cachedPath && cachedPath !== url) {
          // 缓存成功，更新显示
          this.displayUrl = cachedPath
          this.hasCache = true
          console.log('[CachedImage] 缓存成功:', url)
        }
      } catch (e) {
        console.warn('[CachedImage] 缓存失败:', e)
      }
    },

    handleLoad() {
      this.$emit('load')
    },
    handleError() {
      console.warn('[CachedImage] 图片加载失败:', this.src)
      this.$emit('error')
    }
  }
}
</script>

<style lang="scss" scoped>
.cached-image {
  display: block;
}
</style>
