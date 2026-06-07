/**
 * 媒体文件缓存工具 - 缓存图片、视频、头像等媒体资源
 * 支持本地文件系统缓存，提升加载速度和离线体验
 */

// 缓存目录
const CACHE_DIR = '_media_cache'

// 文件类型映射
const MIME_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime'
}

export const mediaCache = {
  /**
   * 获取缓存的本地文件路径
   * @param {string} url 远程URL
   * @returns {string|null} 本地路径或null（未缓存）
   */
  getLocalPath(url) {
    if (!url) return null
    
    try {
      const cacheKey = this._getCacheKey(url)
      const cached = uni.getStorageSync('media_cache_' + cacheKey)
      if (cached && cached.expire > Date.now()) {
        return cached.path
      }
    } catch (e) {
      console.warn('[MediaCache] 获取缓存失败:', e)
    }
    return null
  },

  /**
   * 缓存图片到本地
   * @param {string} url 远程URL
   * @param {number} ttl 缓存时间（秒），默认7天
   * @returns {Promise<string>} 本地文件路径
   */
  async cacheImage(url, ttl = 604800) {
    if (!url) return null
    
    // 先检查是否已有缓存
    const localPath = this.getLocalPath(url)
    if (localPath) {
      return localPath
    }

    // 下载并缓存
    try {
      const result = await this._downloadFile(url)
      if (result.tempFilePath) {
        // 保存缓存记录
        const cacheKey = this._getCacheKey(url)
        uni.setStorageSync('media_cache_' + cacheKey, {
          path: result.tempFilePath,
          expire: Date.now() + ttl * 1000,
          url: url
        })
        return result.tempFilePath
      }
    } catch (e) {
      console.warn('[MediaCache] 下载失败，使用原始URL:', e)
    }
    
    return url
  },

  /**
   * 获取图片URL（优先使用缓存）
   * @param {string} url 远程URL
   * @param {number} ttl 缓存时间
   * @returns {Promise<string>} 本地路径或原始URL
   */
  async getCachedImageUrl(url, ttl = 604800) {
    if (!url) return ''
    
    // 如果已经是本地路径，直接返回
    if (this._isLocalPath(url)) {
      return url
    }

    // 尝试获取缓存
    const localPath = this.getLocalPath(url)
    if (localPath) {
      return localPath
    }

    // 后台异步下载缓存，同时返回原始URL
    this.cacheImage(url, ttl).catch(() => {})
    
    return url
  },

  /**
   * 预加载图片列表
   * @param {string[]} urls URL列表
   */
  async preloadImages(urls) {
    const promises = urls.map(url => this.cacheImage(url))
    await Promise.allSettled(promises)
  },

  /**
   * 清除特定URL的缓存
   * @param {string} url
   */
  clear(url) {
    if (!url) return
    try {
      const cacheKey = this._getCacheKey(url)
      const cached = uni.getStorageSync('media_cache_' + cacheKey)
      if (cached && cached.path) {
        // 删除本地文件
        uni.removeSavedFile({
          filePath: cached.path,
          fail: () => {}
        })
      }
      uni.removeStorageSync('media_cache_' + cacheKey)
    } catch (e) {
      console.warn('[MediaCache] 清除缓存失败:', e)
    }
  },

  /**
   * 清除所有媒体缓存
   */
  clearAll() {
    try {
      const info = uni.getStorageInfoSync()
      info.keys.filter(k => k.startsWith('media_cache_')).forEach(key => {
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
    } catch (e) {
      console.warn('[MediaCache] 清除所有缓存失败:', e)
    }
  },

  /**
   * 获取缓存大小（字节）
   */
  getCacheSize() {
    let totalSize = 0
    try {
      const info = uni.getStorageInfoSync()
      info.keys.filter(k => k.startsWith('media_cache_')).forEach(key => {
        try {
          const cached = uni.getStorageSync(key)
          if (cached && cached.path) {
            // 估算大小
            totalSize += 1024 * 1024 // 假设平均1MB
          }
        } catch (e) {}
      })
    } catch (e) {}
    return totalSize
  },

  /**
   * 内部方法：下载文件
   */
  _downloadFile(url) {
    return new Promise((resolve, reject) => {
      uni.downloadFile({
        url: url,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve({ tempFilePath: res.tempFilePath })
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
  _getCacheKey(url) {
    // 使用MD5或简单哈希
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) - hash) + url.charCodeAt(i)
      hash = hash & hash
    }
    return 'img_' + Math.abs(hash)
  },

  /**
   * 内部方法：判断是否为本地路径
   */
  _isLocalPath(url) {
    return url.startsWith('file://') || url.startsWith('/') || url.startsWith('_doc/')
  }
}
