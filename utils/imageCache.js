/**
 * 图片缓存工具 - 基于uni-app原生缓存能力
 * 实现真正的图片本地缓存，避免重复加载
 */

// 缓存配置
const CACHE_CONFIG = {
  maxSize: 10 * 1024 * 1024, // 最大缓存大小 10MB
  defaultTTL: 60 * 60 * 24 * 7, // 默认缓存时间 7天
}

export const imageCache = {
  /**
   * 获取缓存的图片路径
   * @param {string} url - 原始图片URL
   * @returns {string|null} 缓存路径或null
   */
  getCachedUrl(url) {
    if (!url) return null
    
    try {
      const cacheKey = this._generateKey(url)
      const cached = uni.getStorageSync('img_cache_' + cacheKey)
      if (cached && cached.expire > Date.now()) {
        return cached.path
      }
    } catch (e) {}
    return null
  },

  /**
   * 获取或下载图片（带缓存）
   * 如果有缓存直接返回，否则下载并缓存
   * @param {string} url - 原始图片URL
   * @param {number} ttl - 缓存时间（秒）
   * @returns {Promise<string>} 图片路径（缓存路径或原始URL）
   */
  async getImage(url, ttl = CACHE_CONFIG.defaultTTL) {
    if (!url) return ''

    // 如果已经是本地路径，直接返回
    if (url.startsWith('file://') || url.startsWith('/') || url.startsWith('_doc/')) {
      return url
    }

    // 尝试获取缓存
    const cachedPath = this.getCachedUrl(url)
    if (cachedPath) {
      return cachedPath
    }

    // 下载并缓存
    try {
      const result = await this._downloadImage(url)
      if (result.tempFilePath) {
        // 保存缓存记录
        const cacheKey = this._generateKey(url)
        uni.setStorageSync('img_cache_' + cacheKey, {
          path: result.tempFilePath,
          expire: Date.now() + ttl * 1000,
          url: url,
          size: result.header?.['content-length'] || 0
        })
        return result.tempFilePath
      }
    } catch (e) {}

    return url
  },

  /**
   * 预加载图片列表
   * @param {string[]} urls - 图片URL列表
   */
  async preloadImages(urls) {
    const promises = urls.map(url => this.getImage(url))
    await Promise.allSettled(promises)
  },

  /**
   * 清除单个图片缓存
   * @param {string} url - 图片URL
   */
  clear(url) {
    if (!url) return
    try {
      const cacheKey = this._generateKey(url)
      const cached = uni.getStorageSync('img_cache_' + cacheKey)
      if (cached && cached.path) {
        uni.removeSavedFile({
          filePath: cached.path,
          fail: () => {}
        })
      }
      uni.removeStorageSync('img_cache_' + cacheKey)
    } catch (e) {}
  },

  /**
   * 清除所有图片缓存
   */
  clearAll() {
    try {
      const info = uni.getStorageInfoSync()
      info.keys.filter(k => k.startsWith('img_cache_')).forEach(key => {
        try {
          const cached = uni.getStorageSync(key)
          if (cached && cached.path) {
            uni.removeSavedFile({
              filePath: cached.path,
              fail: () => {}
            })
          }
          uni.removeStorageSync(key)
        } catch (e) {}
      })
    } catch (e) {}
  },

  /**
   * 获取缓存大小
   * @returns {number} 缓存大小（字节）
   */
  getCacheSize() {
    let totalSize = 0
    try {
      const info = uni.getStorageInfoSync()
      info.keys.filter(k => k.startsWith('img_cache_')).forEach(key => {
        try {
          const cached = uni.getStorageSync(key)
          if (cached && cached.size) {
            totalSize += cached.size
          }
        } catch (e) {}
      })
    } catch (e) {}
    return totalSize
  },

  /**
   * 内部方法：下载图片
   */
  _downloadImage(url) {
    return new Promise((resolve, reject) => {
      uni.downloadFile({
        url: url,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve({ 
              tempFilePath: res.tempFilePath,
              header: res.header
            })
          } else {
            reject(new Error('下载失败: ' + res.statusCode))
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  },

  /**
   * 内部方法：生成缓存键
   */
  _generateKey(url) {
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) - hash) + url.charCodeAt(i)
      hash = hash & hash
    }
    return 'img_' + Math.abs(hash)
  }
}
