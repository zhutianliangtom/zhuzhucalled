<template>
  <image 
    :src="displaySrc" 
    :mode="mode" 
    :class="['simple-cached-image', className]"
    @load="handleLoad"
    @error="handleError"
  />
</template>

<script>
import { simpleImageCache } from '@/utils/simpleImageCache'

export default {
  name: 'SimpleCachedImage',
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
      displaySrc: '',
      isLoading: false
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
        this.displaySrc = ''
        return
      }

      // 立即显示原始URL（保证图片能显示）
      this.displaySrc = url
      this.isLoading = true

      // 后台异步获取缓存
      try {
        const cachedPath = await simpleImageCache.get(url)
        if (cachedPath && cachedPath !== url) {
          // 缓存成功，更新显示
          this.displaySrc = cachedPath
        }
      } catch (e) {
        // 缓存失败不影响显示
      } finally {
        this.isLoading = false
      }
    },

    handleLoad() {
      this.$emit('load')
    },

    handleError() {
      this.$emit('error')
    }
  }
}
</script>

<style lang="scss" scoped>
.simple-cached-image {
  display: block;
  background: #f5f5f5;
}
</style>
