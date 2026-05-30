<script>
import { api } from '@/utils/api.js'
import { storage } from '@/utils/storage.js'

// 全局网络状态
let globalNetworkStatus = {
  isOffline: false,
  listeners: []
}

// 基础API地址
const baseUrl = 'http://183.66.27.20:41412'

// 设置网络状态
export function setNetworkStatus(isOffline) {
  globalNetworkStatus.isOffline = isOffline
  console.log('全局网络状态:', isOffline ? '离线' : '在线')
  
  // 通知所有监听的页面
  globalNetworkStatus.listeners.forEach(listener => {
    try {
      listener(isOffline)
    } catch (e) {
      console.error('通知网络状态失败:', e)
    }
  })
}

// 监听网络状态
export function onNetworkStatusChange(callback) {
  globalNetworkStatus.listeners.push(callback)
  return () => {
    globalNetworkStatus.listeners = globalNetworkStatus.listeners.filter(l => l !== callback)
  }
}

// 版本管理：获取当前 App 版本号
function getAppVersion() {
  try {
    // #ifdef APP-PLUS
    if (typeof plus !== 'undefined' && plus && plus.runtime) {
      return plus.runtime.versionCode || ''
    }
    // #endif
  } catch (e) {
    console.error('获取版本号失败:', e)
  }
  return ''
}

// 监听 Android 通知点击事件，跳转到对应对话
export default {
  onLaunch: function() {
    console.log('App Launch')
    
    // 设置全局深色模式
    this.setGlobalDarkMode()
    
    // App启动就启动心跳检测
    try {
      console.log('启动心跳检测')
      api.resetHeartbeat()
    } catch (e) {
      console.error('启动心跳失败:', e)
    }
    
    // 不管是否登录，都跳转到主页
    uni.reLaunch({ url: '/pages/index/index' })
    
    // #ifdef APP-PLUS
    const initPlusApp = () => {
      try {
        if (typeof plus === 'undefined' || !plus || !plus.runtime) {
          setTimeout(initPlusApp, 100)
          return
        }
        
        const _self = this
        // 注册 push 点击事件
        if (plus.push) {
          plus.push.addEventListener('click', function(msg) {
            try {
              const payload = typeof msg.payload === 'string'
                ? JSON.parse(msg.payload)
                : msg.payload
              if (payload && payload.userId) {
                uni.navigateTo({
                  url: `/pages/message/chat?userId=${payload.userId}&userName=${encodeURIComponent(payload.userName || '')}`
                })
              }
            } catch (e) {
              console.error('push click parse error', e)
            }
          })
        }

        // 启动时清除角标
        if (plus.runtime) {
          plus.runtime.setBadgeNumber(0)
        }

        // ─── 检测版本更新（强制检测）───
        this.checkUpdate()
      } catch (e) {
        console.error('初始化plus失败:', e)
      }
    }
    
    // 延迟初始化 plus
    setTimeout(initPlusApp, 500)
    // #endif
  },
  onShow: function() {
    console.log('App Show')
    // #ifdef APP-PLUS
    try {
      if (typeof plus !== 'undefined' && plus && plus.runtime) {
        plus.runtime.setBadgeNumber(0)
      }
      // 每次App显示时强制检测更新
      this.checkUpdate()
    } catch (e) {
      console.error('onShow设置角标失败:', e)
    }
    // #endif
  },
  onHide: function() {
    console.log('App Hide')
    // 应用隐藏时继续心跳检测
  },
  onUnload: function() {
    console.log('App Unload')
    // 应用卸载时停止心跳
    try {
      if (api && api.stopHeartbeat) {
        api.stopHeartbeat()
      }
    } catch (e) {
      console.error('停止心跳失败:', e)
    }
  },
  methods: {
    // 检测版本更新（仅 App 平台 - 强制检测）
    async checkUpdate() {
      // #ifdef APP-PLUS
      try {
        // 每次强制访问服务器，不缓存
        const res = await api.getLatestVersion()
        if (!res || !res.data) return

        const latest = res.data
        const currentCode = parseInt(getAppVersion()) || 0

        if (latest.versionCode > currentCode) {
          // 发现新版本，弹窗提示
          const modalRes = await uni.showModal({
            title: `发现新版本 v${latest.version}`,
            content: latest.changelog || '点击确定前往下载页面',
            confirmText: '立即更新',
            showCancel: !latest.forceUpdate
          })

          if (modalRes.confirm) {
            // 获取加密下载地址并跳转到下载页面
            try {
              const downloadRes = await api.getEncryptedDownloadUrl(latest.id)
              const encryptedUrl = downloadRes?.data?.url || ''
              const downloadPageUrl = `${baseUrl}/download?token=${encodeURIComponent(encryptedUrl)}`
              
              if (typeof plus !== 'undefined' && plus && plus.runtime) {
                plus.runtime.openURL(downloadPageUrl)
              }
            } catch (e) {
              // 如果获取加密地址失败，直接跳转到普通下载页
              console.error('获取加密下载地址失败，使用普通下载:', e)
              const downloadUrl = `${baseUrl}/download`
              if (typeof plus !== 'undefined' && plus && plus.runtime) {
                plus.runtime.openURL(downloadUrl)
              }
            }
          }
          // 强制更新且用户点了取消 → 退出 App
          if (latest.forceUpdate && !modalRes.confirm) {
            try {
              if (typeof plus !== 'undefined' && plus && plus.runtime) {
                plus.runtime.quit()
              }
            } catch (e) {
              console.error('退出App失败:', e)
            }
          }
        }
      } catch (e) {
        console.error('版本检测失败', e)
      }
      // #endif
    },
    // 设置全局深色模式
    setGlobalDarkMode() {
      // #ifdef APP-PLUS
      try {
        if (typeof plus !== 'undefined' && plus.navigator) {
          // 设置状态栏为深色背景，白色文字
          plus.navigator.setStatusBarStyle('light')
          plus.navigator.setStatusBarBackground('#1a1a1a')
          
          // 设置系统导航栏为深色
          if (plus.navigator.setNavigationBarColor) {
            plus.navigator.setNavigationBarColor('#1a1a1a')
          }
        }
      } catch (e) {
        console.error('设置深色模式失败:', e)
      }
      // #endif
    }
  }
}
</script>

<style lang="scss">
  /*每个页面公共css */
  @import '@/uni_modules/uni-scss/index.scss';
  /* #ifndef APP-NVUE */
  @import '@/static/customicons.css';
  // 设置整个项目的背景色
  page {
    background-color: #f5f5f5;
  }
  
  // 修复底部导航栏白边
  /* #ifdef APP-PLUS */
  .uni-app--showleftwindow,
  .uni-page-body {
    background-color: #1a1a1a !important;
  }
  /* #endif */
  /* #endif */
  .example-info {
    font-size: 14px;
    color: #333;
    padding: 10px;
  }
</style>
