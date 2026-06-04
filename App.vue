<script>
import { api } from '@/utils/api.js'
import { storage } from '@/utils/storage.js'

// 全局网络状态
let globalNetworkStatus = {
  isOffline: false,
  listeners: []
}

// 基础API地址
const baseUrl = 'https://chentian.dpdns.org'

// 保活定时器引用
let keepAliveTimer = null

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

    // 应用主题设置
    this.applyTheme()

    // 监听主题切换
    uni.$on('theme-change', ({ isDark }) => {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1]
      if (page && page.$el && page.$el.classList) {
        if (isDark) page.$el.classList.add('theme-dark')
        else page.$el.classList.remove('theme-dark')
      }
    })

    // 申请通知权限
    this.requestNotificationPermission()
    
    // App启动就启动心跳检测
    try {
      console.log('启动心跳检测')
      api.resetHeartbeat()
    } catch (e) {
      console.error('启动心跳失败:', e)
    }
    
    // 启动Android保活服务
    this.startAndroidKeepAlive()
    
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
    
    // 清理保活定时器
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer)
      keepAliveTimer = null
      console.log('保活定时器已清理')
    }
  },
  methods: {
    // 启动Android保活服务
    startAndroidKeepAlive() {
      // #ifdef APP-PLUS
      try {
        if (typeof plus === 'undefined' || !plus.android) {
          return
        }
        
        console.log('开始初始化Android保活服务')
        const main = plus.android.runtimeMainActivity()
        const Build = plus.android.importClass('android.os.Build')
        const Intent = plus.android.importClass('android.content.Intent')
        const PendingIntent = plus.android.importClass('android.app.PendingIntent')
        const PowerManager = plus.android.importClass('android.os.PowerManager')
        const Context = plus.android.importClass('android.content.Context')
        const Uri = plus.android.importClass('android.net.Uri')
        const Settings = plus.android.importClass('android.provider.Settings')
        
        // 1. 创建前台通知（保活）
        this.createForegroundNotification()

        // 2. 设置定时唤醒
        this.setupWakeLock()

        // 3. 定时任务保持活跃
        this.setupKeepAliveTasks()
        
        console.log('Android保活服务初始化完成')
      } catch (e) {
        console.error('Android保活服务初始化失败:', e)
      }
      // #endif
    },
    
    // 创建前台通知
    createForegroundNotification() {
      // #ifdef APP-PLUS
      try {
        if (typeof plus === 'undefined' || !plus.android) {
          return
        }
        
        const main = plus.android.runtimeMainActivity()
        const Build = plus.android.importClass('android.os.Build')
        const NotificationManager = plus.android.importClass('android.app.NotificationManager')
        const NotificationChannel = plus.android.importClass('android.app.NotificationChannel')
        const NotificationCompat = plus.android.importClass('androidx.core.app.NotificationCompat')
        const Context = plus.android.importClass('android.content.Context')
        const Intent = plus.android.importClass('android.content.Intent')
        const PendingIntent = plus.android.importClass('android.app.PendingIntent')
        
        // 创建通知渠道
        const channelId = 'keep_alive_channel'
        const channelName = '应用保活服务'
        const notificationManager = main.getSystemService(Context.NOTIFICATION_SERVICE)
        
        if (Build.VERSION.SDK_INT >= 26) {
          const channel = new NotificationChannel(
            channelId,
            channelName,
            NotificationManager.IMPORTANCE_LOW
          )
          channel.setShowBadge(false)
          channel.setSound(null, null)
          notificationManager.createNotificationChannel(channel)
        }
        
        // 创建启动Activity的Intent
        const launchIntent = main.getPackageManager().getLaunchIntentForPackage(main.getPackageName())
        const pendingIntent = PendingIntent.getActivity(
          main,
          0,
          launchIntent,
          PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        )
        
        // 创建通知
        const builder = new NotificationCompat.Builder(main, channelId)
        builder.setContentTitle('校园失物招领正在运行')
        builder.setContentText('保持后台运行，及时接收新消息')
        builder.setSmallIcon(17301590) // 默认系统图标
        builder.setContentIntent(pendingIntent)
        builder.setOngoing(true)
        builder.setAutoCancel(false)
        builder.setPriority(NotificationCompat.PRIORITY_LOW)
        builder.setCategory(NotificationCompat.CATEGORY_SERVICE)
        
        // 显示通知
        notificationManager.notify(10001, builder.build())
        
        console.log('前台保活通知已创建')
      } catch (e) {
        console.log('创建前台通知失败:', e)
      }
      // #endif
    },
    
    // 设置WakeLock
    setupWakeLock() {
      // #ifdef APP-PLUS
      try {
        if (typeof plus === 'undefined' || !plus.android) {
          return
        }
        
        const main = plus.android.runtimeMainActivity()
        const PowerManager = plus.android.importClass('android.os.PowerManager')
        const Context = plus.android.importClass('android.content.Context')
        
        const powerManager = main.getSystemService(Context.POWER_SERVICE)
        const wakeLock = powerManager.newWakeLock(
          PowerManager.PARTIAL_WAKE_LOCK,
          'LostFound:KeepAlive'
        )
        
        wakeLock.setReferenceCounted(false)
        wakeLock.acquire(10 * 60 * 60 * 1000) // 10小时
        
        console.log('WakeLock已获取')
      } catch (e) {
        console.log('获取WakeLock失败:', e)
      }
      // #endif
    },
    
    // 设置保活定时任务
    setupKeepAliveTasks() {
      // #ifdef APP-PLUS
      try {
        // 每30秒执行一次心跳
        keepAliveTimer = setInterval(() => {
          try {
            // 1. 发送网络心跳
            if (api && api.checkHeartbeat) {
              api.checkHeartbeat().catch(() => {})
            }
            
            // 2. 重新获取WakeLock
            this.setupWakeLock()
            
            // 3. 刷新前台通知（防止被系统杀掉）
            this.createForegroundNotification()
            
            console.log('保活任务执行:', new Date().toISOString())
          } catch (e) {
            console.log('保活任务执行失败:', e)
          }
        }, 30000)
        
        console.log('保活定时任务已设置')
      } catch (e) {
        console.log('设置保活定时任务失败:', e)
      }
      // #endif
    },
    
    // 申请通知权限（仅首次，不跳转设置页）
    requestNotificationPermission() {
      // #ifdef APP-PLUS
      try {
        if (typeof plus === 'undefined' || !plus) return
        if (plus.android) {
          const main = plus.android.runtimeMainActivity()
          const Build = plus.android.importClass('android.os.Build')
          const Context = plus.android.importClass('android.content.Context')
          const notificationManager = main.getSystemService(Context.NOTIFICATION_SERVICE)
          const channelId = 'lost_found_msg'
          const channelName = '新消息通知'

          // Android 8.0+ 创建通知渠道（必需，否则推送不显示）
          if (Build.VERSION.SDK_INT >= 26) {
            try {
              const NotificationChannel = plus.android.importClass('android.app.NotificationChannel')
              const ch = notificationManager.getNotificationChannel(channelId)
              if (!ch) {
                const nc = new NotificationChannel(channelId, channelName, 4) // IMPORTANCE_HIGH=4
                nc.enableVibration(true)
                nc.setShowBadge(true)
                notificationManager.createNotificationChannel(nc)
                console.log('[通知] 渠道已创建')
              }
            } catch (e) { console.log('[通知] 渠道创建失败:', e) }
          }

          // 静默检查权限，不弹窗不跳转（首次打开由系统自动询问）
        } else if (plus.ios) {
          try {
            const UNUserNotificationCenter = plus.ios.import('UNUserNotificationCenter')
            const center = UNUserNotificationCenter.currentNotificationCenter()
            center.requestAuthorizationWithOptionsCompletionHandler(7, function(granted) {}) // badge+sound+alert
          } catch (e) {}
        }
      } catch (e) {}
      // #endif
    },
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
          uni.showModal({
            title: `发现新版本 v${latest.version}`,
            content: latest.changelog || '点击确定前往下载页面',
            confirmText: '立即更新',
            showCancel: !latest.forceUpdate,
            success: (modalRes) => {
              if (modalRes.confirm) {
                // 获取加密下载地址并跳转到下载页面
                api.getEncryptedDownloadUrl(latest.id).then(downloadRes => {
                  const encryptedUrl = downloadRes?.data?.url || ''
                  const downloadPageUrl = `${baseUrl}/download?token=${encodeURIComponent(encryptedUrl)}`
                  
                  if (typeof plus !== 'undefined' && plus && plus.runtime) {
                    plus.runtime.openURL(downloadPageUrl)
                  }
                }).catch(e => {
                  // 如果获取加密地址失败，直接跳转到普通下载页
                  console.error('获取加密下载地址失败，使用普通下载:', e)
                  const downloadUrl = `${baseUrl}/download`
                  if (typeof plus !== 'undefined' && plus && plus.runtime) {
                    plus.runtime.openURL(downloadUrl)
                  }
                })
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
          })
        }
      } catch (e) {
        console.error('版本检测失败', e)
      }
      // #endif
    },
    // 根据设置应用主题（浅色/深色）
    applyTheme() {
      const settings = storage.getSettings() || {}
      const isDark = settings.theme === 'dark'
      // #ifdef APP-PLUS
      try {
        if (typeof plus !== 'undefined' && plus.navigator) {
          if (isDark) {
            plus.navigator.setStatusBarStyle('light')
            plus.navigator.setStatusBarBackground('#1a1a2e')
            if (plus.navigator.setNavigationBarColor) {
              plus.navigator.setNavigationBarColor('#1a1a2e')
            }
          } else {
            plus.navigator.setStatusBarStyle('dark')
            plus.navigator.setStatusBarBackground('#ffffff')
            if (plus.navigator.setNavigationBarColor) {
              plus.navigator.setNavigationBarColor('#ffffff')
            }
          }
        }
      } catch (e) {}
      // #endif

      // 延迟给当前页面加主题类（等页面渲染完成）
      setTimeout(() => {
        const pages = getCurrentPages()
        const page = pages[pages.length - 1]
        if (page && page.$el && page.$el.classList) {
          if (isDark) page.$el.classList.add('theme-dark')
          else page.$el.classList.remove('theme-dark')
        }
      }, 300)
    }
  }
}
</script>

<style lang="scss">
  /*每个页面公共css */
  @import '@/uni_modules/uni-scss/index.scss';
  /* #ifndef APP-NVUE */
  @import '@/static/customicons.css';

  // 默认浅色模式
  page { background-color: #f5f5f5; }
  /* #ifdef APP-PLUS */
  .uni-app--showleftwindow,
  .uni-page-body, .uni-app,
  uni-page-wrapper, uni-page-body { background-color: #f5f5f5 !important; }
  /* #endif */

  // ========== 深色模式全局覆盖 ==========
  page.theme-dark {
    background-color: #0f0f1a;
    /* #ifdef APP-PLUS */
    .uni-app--showleftwindow, .uni-page-body, .uni-app,
    uni-page-wrapper, uni-page-body { background-color: #0f0f1a !important; }
    /* #endif */

    // 容器
    .container { background-color: #0f0f1a; }
    // 卡片
    .item-card, .form, .menu-list, .menu-item, .conversation-item,
    .settings-list, .settings-item, .stats-section, .guest-card,
    .user-header, .detail-card, .publish-form { background-color: #1a1a2e; }
    // 头部
    .header, .fixed-header { background: #1a1a2e; }
    // 分隔
    .stat-divider { background: #2a2a3e; }
    .tabbar-container .custom-tabbar { background: #1a1a2e; border-top-color: #2a2a3e; }
    // 文字
    .item-title, .title, .user-name, .label, .menu-text, .conv-name,
    .settings-text, .header-title, .detail-title, .guest-title { color: #e0e0e0; }
    .item-desc, .item-time, .tab-text, .user-class, .menu-count,
    .conv-time, .conv-preview, .stat-label, .guest-desc, .empty-text,
    .settings-arrow, .version-text, .search-placeholder { color: #999; }
    // 边框
    .input, .form-item input { border-color: #2a2a3e; background: #1a1a2e; color: #e0e0e0; }
    // 搜索
    .search-bar { background: rgba(26, 26, 46, 0.95); }
    .search-placeholder { color: #999; }
    // 标签/筛选
    .tabs, .time-filter { background: #1a1a2e; border-bottom-color: #2a2a3e; }
    .tab-item { color: #999; }
    .time-filter-item { background: #2a2a3e; color: #999; }
    // 导航栏
    .tab-text { color: #666; }
    // 空状态
    .empty-icon { opacity: 0.6; }
  }
  /* #endif */
</style>
