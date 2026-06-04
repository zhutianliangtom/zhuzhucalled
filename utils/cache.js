/**
 * 缓存工具 - 减少重复请求，提升加载速度
 * 先展示缓存数据，再后台刷新
 */

// 内存缓存（当前会话）
const memCache = {}

// 默认 TTL（秒）
const TTL = {
  items: 30,       // 物品列表 30 秒
  messages: 10,    // 消息列表 10 秒
  conversation: 10,// 对话详情 10 秒
  user: 60,        // 用户信息 60 秒
  stats: 60,       // 统计数据 60 秒
}

export const cache = {
  /**
   * 获取缓存，未过期返回数据，过期返回 null
   * @param {string} key
   * @param {number} ttl 秒
   */
  getSync(key, ttl = 30) {
    // 内存缓存优先
    if (memCache[key] && Date.now() - memCache[key].ts < ttl * 1000) {
      return memCache[key].data
    }
    // 存储缓存兜底（跨页面切换时用）
    try {
      const raw = uni.getStorageSync('cache_' + key)
      if (raw && Date.now() - raw.ts < ttl * 1000) {
        memCache[key] = raw
        return raw.data
      }
    } catch (e) {}
    return null
  },

  /**
   * 写入缓存
   * @param {string} key
   * @param {*} data
   */
  set(key, data) {
    const entry = { data, ts: Date.now() }
    memCache[key] = entry
    try { uni.setStorageSync('cache_' + key, entry) } catch (e) {}
  },

  /**
   * 带缓存的请求封装
   * - 有缓存立即返回缓存数据
   * - 同时后台刷新，新数据通过 onRefresh 回调通知
   *
   * @param {string} key      缓存键
   * @param {Function} fetcher 请求函数，返回 Promise<data>
   * @param {object} opts    { ttl, onLoad(缓存数据), onRefresh(新数据) }
   */
  async fetch(key, fetcher, opts = {}) {
    const { ttl = 30, onLoad, onRefresh } = opts

    // 1. 尝试读缓存
    const cached = this.getSync(key, ttl)
    if (cached && onLoad) {
      onLoad(cached)
    }

    // 2. 如果缓存未过期且不是强制刷新，跳过网络请求
    if (cached && !opts.force) {
      return cached
    }

    // 3. 网络请求
    try {
      const fresh = await fetcher()
      if (fresh !== undefined && fresh !== null) {
        this.set(key, fresh)
        if (onRefresh) onRefresh(fresh)
      }
      return fresh
    } catch (e) {
      // 请求失败但有缓存，继续用缓存
      if (cached) return cached
      throw e
    }
  },

  // 清除特定缓存
  clear(key) {
    delete memCache[key]
    try { uni.removeStorageSync('cache_' + key) } catch (e) {}
  },

  // 清除所有缓存
  clearAll() {
    Object.keys(memCache).forEach(k => delete memCache[k])
    try {
      const info = uni.getStorageInfoSync()
      info.keys.filter(k => k.startsWith('cache_')).forEach(k => uni.removeStorageSync(k))
    } catch (e) {}
  },

  TTL
}
