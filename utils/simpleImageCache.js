/**
 * 简单图片缓存工具
 * 使用 uni-app 的 downloadFile 和 fileSystemManager 实现本地缓存
 */

const STORAGE_KEY_PREFIX = 'img_cache_'
const MAX_CACHE_SIZE = 10 * 1024 * 1024 // 10MB

export const simpleImageCache = {
  /**
   * 获取图片（带缓存）
   * @param {string} url - 图片URL
   * @returns {Promise<string>} 返回本地路径或原始URL
   */
  async get(url) {
    if (!url) return ''
    
    // 如果已经是本地路径，直接返回
    if (url.startsWith('file://') || url.startsWith('/') || url.startsWith('_doc/')) {
      return url
    }

    // 检查缓存
    const cachedPath = this._getFromCache(url)
    if (cachedPath) {
      // console.log('[缓存] 使用本地缓存:', url)
      return cachedPath
    }

    // 下载并缓存
    try {
      const tempPath = await this._download(url)
      if (tempPath) {
        const savedPath = await this._save(tempPath)
        if (savedPath) {
          this._saveToCache(url, savedPath)
          // console.log('[缓存] 缓存成功:', url)
          return savedPath
        }
      }
    } catch (e) {}

    return url
  },

  /**
   * 批量获取图片
   */
  async getAll(urls) {
    const results = await Promise.allSettled(urls.map(url => this.get(url)))
    return results.map(r => r.value || r.reason || '')
  },

  /**
   * 清除缓存
   */
  clear() {
    try {
      const info = uni.getStorageInfoSync()
      info.keys.filter(k => k.startsWith(STORAGE_KEY_PREFIX)).forEach(key => {
        const cached = uni.getStorageSync(key)
        if (cached && cached.path) {
          uni.removeSavedFile({ filePath: cached.path, fail: () => {} })
        }
        uni.removeStorageSync(key)
      })
    } catch (e) {}
  },

  _getFromCache(url) {
    try {
      const key = this._hash(url)
      const cached = uni.getStorageSync(STORAGE_KEY_PREFIX + key)
      if (cached && cached.path) {
        // 检查文件是否存在
        return cached.path
      }
    } catch (e) {}
    return null
  },

  _saveToCache(url, path) {
    try {
      const key = this._hash(url)
      uni.setStorageSync(STORAGE_KEY_PREFIX + key, {
        path: path,
        time: Date.now()
      })
    } catch (e) {}
  },

  _download(url) {
    return new Promise((resolve) => {
      uni.downloadFile({
        url: url,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.tempFilePath)
          } else {
            resolve(null)
          }
        },
        fail: () => {
          resolve(null)
        }
      })
    })
  },

  _save(tempPath) {
    return new Promise((resolve) => {
      uni.saveFile({
        tempFilePath: tempPath,
        success: (res) => {
          resolve(res.savedFilePath)
        },
        fail: () => {
          resolve(null)
        }
      })
    })
  },

  _hash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }
}
