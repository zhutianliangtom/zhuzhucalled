/**
 * 缓存工具 - 减少重复请求，提升加载速度
 * 先展示缓存数据，再后台刷新
 * 
 * 特性：
 * 1. 双层缓存：内存缓存 + 本地存储缓存
 * 2. 智能过期策略：不同数据类型有不同的TTL
 * 3. 后台刷新：显示缓存的同时后台加载新数据
 * 4. 离线支持：断网时使用缓存数据
 */

// 内存缓存（当前会话，读取最快）
const memCache = {}

// 默认 TTL（秒）- 优化缓存时间
const TTL = {
  items: 120,      // 物品列表 2分钟
  itemDetail: 300, // 物品详情 5分钟
  messages: 30,    // 消息列表 30秒
  conversation: 60,// 对话详情 1分钟
  user: 300,       // 用户信息 5分钟
  userStats: 180,  // 用户统计 3分钟
  stats: 300,      // 全局统计 5分钟
  users: 120,      // 用户搜索 2分钟
  blocked: 60,     // 黑名单 1分钟
  version: 300,    // 版本信息 5分钟
  categories: 600, // 分类数据 10分钟
}

// 缓存状态标记
const cacheStatus = {
  updating: new Set(), // 正在更新中的缓存键
}

export const cache = {
  /**
   * 获取缓存，未过期返回数据，过期返回 null
   * @param {string} key
   * @param {number} ttl 秒
   */
  getSync(key, ttl = 30) {
    // 内存缓存优先（最快）
    if (memCache[key]) {
      if (Date.now() - memCache[key].ts < ttl * 1000) {
        return memCache[key].data
      }
      // 过期但仍有数据，返回过期数据（用于离线场景）
      return memCache[key].data
    }
    // 存储缓存兜底（跨页面切换时用）
    try {
      const raw = uni.getStorageSync('cache_' + key)
      if (raw) {
        memCache[key] = raw
        // 过期但仍有数据，返回过期数据
        return raw.data
      }
    } catch (e) {}
    return null
  },

  /**
   * 获取缓存元信息（包含时间戳）
   * @param {string} key
   * @param {number} ttl
   */
  getWithMeta(key, ttl = 30) {
    // 内存缓存优先
    if (memCache[key]) {
      const isExpired = Date.now() - memCache[key].ts >= ttl * 1000
      return {
        data: memCache[key].data,
        ts: memCache[key].ts,
        isExpired,
        isValid: !isExpired
      }
    }
    // 存储缓存兜底
    try {
      const raw = uni.getStorageSync('cache_' + key)
      if (raw) {
        memCache[key] = raw
        const isExpired = Date.now() - raw.ts >= ttl * 1000
        return {
          data: raw.data,
          ts: raw.ts,
          isExpired,
          isValid: !isExpired
        }
      }
    } catch (e) {}
    return { data: null, ts: 0, isExpired: true, isValid: false }
  },

  /**
   * 写入缓存
   * @param {string} key
   * @param {*} data
   */
  set(key, data) {
    if (data === undefined || data === null) return
    
    const entry = { data, ts: Date.now() }
    memCache[key] = entry
    try {
      uni.setStorageSync('cache_' + key, entry)
    } catch (e) {
      console.warn('[Cache] 写入存储失败:', e)
    }
  },

  /**
   * 带缓存的请求封装（核心方法）
   * - 有缓存立即返回缓存数据（通过onLoad回调）
   * - 后台异步刷新新数据（通过onRefresh回调）
   * - 支持强制刷新
   * - 支持节流（同一key不会同时发起多个请求）
   *
   * @param {string} key      缓存键
   * @param {Function} fetcher 请求函数，返回 Promise<data>
   * @param {object} opts     { ttl, onLoad(缓存数据), onRefresh(新数据), force }
   * @returns {Promise}       返回最终数据（可能是缓存或新数据）
   */
  async fetch(key, fetcher, opts = {}) {
    const { ttl = 30, onLoad, onRefresh, force = false } = opts

    // 1. 获取缓存信息
    const cachedInfo = this.getWithMeta(key, ttl)
    const hasCache = cachedInfo.data !== null
    const needsRefresh = force || cachedInfo.isExpired

    // 2. 如果有缓存，立即通过onLoad返回
    if (hasCache && onLoad) {
      try {
        onLoad(cachedInfo.data)
      } catch (e) {
        console.error('[Cache] onLoad回调执行失败:', e)
      }
    }

    // 3. 如果不需要刷新，直接返回缓存
    if (!needsRefresh && hasCache) {
      return cachedInfo.data
    }

    // 4. 检查是否正在更新，避免重复请求
    if (cacheStatus.updating.has(key)) {
      // 等待正在进行的请求完成
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!cacheStatus.updating.has(key)) {
            clearInterval(checkInterval)
            resolve(this.getSync(key, ttl))
          }
        }, 50)
      })
    }

    // 5. 标记正在更新
    cacheStatus.updating.add(key)

    // 6. 执行网络请求
    try {
      const fresh = await fetcher()
      if (fresh !== undefined && fresh !== null) {
        this.set(key, fresh)
        if (onRefresh) {
          try {
            onRefresh(fresh)
          } catch (e) {
            console.error('[Cache] onRefresh回调执行失败:', e)
          }
        }
      }
      return fresh
    } catch (e) {
      // 请求失败但有缓存，继续用缓存
      if (hasCache) {
        console.warn('[Cache] 请求失败，使用缓存数据:', key)
        return cachedInfo.data
      }
      throw e
    } finally {
      // 移除更新标记
      cacheStatus.updating.delete(key)
    }
  },

  /**
   * 仅获取缓存数据（不发起网络请求）
   * @param {string} key
   * @param {number} ttl
   */
  get(key, ttl = 30) {
    return this.getSync(key, ttl)
  },

  /**
   * 异步获取缓存（兼容Promise风格）
   * @param {string} key
   * @param {number} ttl
   */
  async getAsync(key, ttl = 30) {
    return Promise.resolve(this.getSync(key, ttl))
  },

  /**
   * 删除特定缓存
   * @param {string} key
   */
  clear(key) {
    delete memCache[key]
    try {
      uni.removeStorageSync('cache_' + key)
    } catch (e) {
      console.warn('[Cache] 删除缓存失败:', e)
    }
  },

  /**
   * 清除所有缓存
   */
  clearAll() {
    Object.keys(memCache).forEach(k => delete memCache[k])
    try {
      const info = uni.getStorageInfoSync()
      info.keys.filter(k => k.startsWith('cache_')).forEach(k => {
        try {
          uni.removeStorageSync(k)
        } catch (e) {}
      })
    } catch (e) {
      console.warn('[Cache] 清除所有缓存失败:', e)
    }
  },

  /**
   * 检查缓存是否存在且有效
   * @param {string} key
   * @param {number} ttl
   */
  exists(key, ttl = 30) {
    const info = this.getWithMeta(key, ttl)
    return info.isValid
  },

  /**
   * 获取缓存剩余时间（秒）
   * @param {string} key
   * @param {number} ttl
   */
  getRemainingTime(key, ttl = 30) {
    const info = this.getWithMeta(key, ttl)
    if (!info.data) return -1
    const remaining = Math.max(0, ttl - Math.floor((Date.now() - info.ts) / 1000))
    return remaining
  },

  /**
   * 批量设置缓存
   * @param {Array} items [{ key, data }]
   */
  batchSet(items) {
    items.forEach(item => {
      if (item.key && item.data !== undefined) {
        this.set(item.key, item.data)
      }
    })
  },

  /**
   * 批量获取缓存
   * @param {Array} keys
   * @param {number} ttl
   */
  batchGet(keys, ttl = 30) {
    const result = {}
    keys.forEach(key => {
      result[key] = this.getSync(key, ttl)
    })
    return result
  },

  // 默认TTL配置
  TTL
}
