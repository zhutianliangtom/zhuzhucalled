<script>
import { api } from '@/utils/api.js'
import { storage } from '@/utils/storage.js'

// 全局网络状态
let globalNetworkStatus = {
  isOffline: false,
  isOnline: true,
  isOfflineGameShown: false,
  listeners: []
}

// 离线游戏状态
let showOfflineGame = false

// 网络检测失败计数
let connectionFailCount = 0
const MAX_CONNECTION_FAILS = 5 // 连续失败5次才显示离线页面（约25秒）

// 基础API地址
const baseUrl = 'https://chentian.dpdns.org'

// 保活定时器引用
let keepAliveTimer = null

// 设置网络状态
export function setNetworkStatus(isOffline) {
  globalNetworkStatus.isOffline = isOffline
  
  // 通知所有监听的页面
  globalNetworkStatus.listeners.forEach(listener => {
    try {
      listener(isOffline)
    } catch (e) {}
  })
}

// 监听网络状态
export function onNetworkStatusChange(callback) {
  globalNetworkStatus.listeners.push(callback)
  return () => {
    globalNetworkStatus.listeners = globalNetworkStatus.listeners.filter(l => l !== callback)
  }
}

// 显示离线游戏
export function showOfflineGamePage() {
  showOfflineGame = true
  uni.reLaunch({ url: '/pages/offline-game/offline-game' })
}

// 隐藏离线游戏
export function hideOfflineGamePage() {
  showOfflineGame = false
}

// 检查是否显示离线游戏
export function isShowingOfflineGame() {
  return showOfflineGame
}

// 版本管理：获取当前 App 版本号
function getAppVersion() {
  try {
    // #ifdef APP-PLUS
    if (typeof plus !== 'undefined' && plus && plus.runtime) {
      return plus.runtime.versionCode || ''
    }
    // #endif
  } catch (e) {}
  return ''
}

// 监听 Android 通知点击事件，跳转到对应对话
export default {
  onLaunch: function() {
    // 应用主题设置
    this.applyTheme()

    // 监听主题切换
    uni.$on('theme-change', () => {
      this.applyTheme()
    })

    // 申请通知权限
    this.requestNotificationPermission()
    
    // App启动就启动心跳检测
    try {
      api.resetHeartbeat()
    } catch (e) {}
    
    // 启动Android保活服务
    this.startAndroidKeepAlive()
    
    // 启动网络检测（离线游戏）
    this.initNetworkCheck()
    
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
            }
          })
        }

        // 启动时清除角标
        if (plus.runtime) {
          plus.runtime.setBadgeNumber(0)
        }

        // ─── 检测版本更新（强制检测）───
        this.checkUpdate()
      } catch (e) {}
    }
    
    // 延迟初始化 plus
    setTimeout(initPlusApp, 500)
    // #endif
  },
  onShow: function() {
    // 每次显示时确保主题正确
    this.applyTheme()
    // #ifdef APP-PLUS
    try {
      if (typeof plus !== 'undefined' && plus && plus.runtime) {
        plus.runtime.setBadgeNumber(0)
      }
      this.checkUpdate()
    } catch (e) {}
    // #endif
  },
  onHide: function() {
    // 应用隐藏时继续心跳检测
  },
  onUnload: function() {
    // 应用卸载时停止心跳
    try {
      if (api && api.stopHeartbeat) {
        api.stopHeartbeat()
      }
    } catch (e) {}
    
    // 清理保活定时器
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer)
      keepAliveTimer = null
    }
  },
  methods: {
    // 初始化网络检测
    initNetworkCheck() {
      // 监听网络状态变化
      uni.onNetworkStatusChange((res) => {
        if (!res.isConnected) {
          this.handleOffline()
        } else {
          this.handleOnline()
        }
      })

      // 定期检查连接
      setInterval(() => {
        this.checkConnection()
      }, 5000)
    },

    // 检查连接
    async checkConnection() {
      try {
        const response = await uni.request({
          url: 'https://chentian.dpdns.org/api/health',
          method: 'GET',
          timeout: 5000
        })

        // 重置失败计数
        connectionFailCount = 0
        
        if (!globalNetworkStatus.isOnline && globalNetworkStatus.isOffline) {
          this.handleOnline()
        }
        globalNetworkStatus.isOnline = true
        globalNetworkStatus.isOffline = false
      } catch (error) {
        globalNetworkStatus.isOnline = false
        
        // 增加失败计数
        connectionFailCount++
        
        // 连续失败达到阈值才标记为离线
        if (connectionFailCount >= MAX_CONNECTION_FAILS) {
          globalNetworkStatus.isOffline = true
          
          // 只有在游戏未显示且未显示过离线页面时才跳转
          if (!showOfflineGame && !globalNetworkStatus.isOfflineGameShown) {
            this.handleOffline()
          }
        }
      }
    },

    // 处理断网
    handleOffline() {
      if (showOfflineGame) return
      showOfflineGame = true
      globalNetworkStatus.isOfflineGameShown = true
      setNetworkStatus(true)
      uni.reLaunch({ url: '/pages/offline-game/offline-game' })
    },

    // 处理恢复网络
    handleOnline() {
      if (!showOfflineGame) return
      showOfflineGame = false
      globalNetworkStatus.isOfflineGameShown = false
      setNetworkStatus(false)
      uni.reLaunch({ url: '/pages/index/index' })
    },
    
    // 启动Android保活服务
    startAndroidKeepAlive() {
      // #ifdef APP-PLUS
      try {
        if (typeof plus === 'undefined' || !plus.android) {
          return
        }
        
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
        
      } catch (e) {}
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
      } catch (e) {}
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
        
      } catch (e) {}
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
            
          } catch (e) {}
        }, 30000)
        
      } catch (e) {}
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
              }
            } catch (e) {}
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
                }).catch(() => {
                  // 如果获取加密地址失败，直接跳转到普通下载页
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
                } catch (e) {}
              }
            }
          })
        }
      } catch (e) {}
      // #endif
    },
    // 深色模式 —— 直接注入 style 标签到 head，最高优先级
    applyTheme() {
      const settings = storage.getSettings() || {}
      const isDark = settings.theme === 'dark'
      // #ifdef APP-PLUS
      try {
        if (typeof plus !== 'undefined' && plus.navigator) {
          if (isDark) {
            plus.navigator.setStatusBarStyle('light')
            plus.navigator.setStatusBarBackground('#1e293b')
            if (plus.navigator.setNavigationBarColor) plus.navigator.setNavigationBarColor('#1e293b')
          } else {
            plus.navigator.setStatusBarStyle('dark')
            plus.navigator.setStatusBarBackground('#ffffff')
            if (plus.navigator.setNavigationBarColor) plus.navigator.setNavigationBarColor('#ffffff')
          }
        }
      } catch (e) {}
      // #endif

      // #ifdef H5
      // 移除旧注入
      const old = document.getElementById('dark-theme-style')
      if (old) old.remove()

      if (isDark) {
        // 延迟注入 + 重试，确保 DOM head 就绪
        const inject = () => {
          if (!document.head) { setTimeout(inject, 200); return }
          const s = document.createElement('style')
          s.id = 'dark-theme-style'
          s.textContent = `
          * { border-color: #334155 !important; }
          page, body, html, uni-app, uni-page, uni-page-wrapper, uni-page-body,
          .container, .content, .item-list, .conversation-list, .user-list,
          .image-gallery, .conversation-list, .collection-list {
            background: #1e293b !important; background-image: none !important;
          }
          .item-card, .form, form, .menu-list, .menu-item, .conversation-item,
          .settings-list, .settings-item, .stats-section, .guest-card, .guest-content,
          .user-header, .detail-card, .publish-form, .info-card, .contact-info,
          .input-area, .input-tools, .context-menu, .search-content, .search-modal,
          .header, .fixed-header, .custom-tabbar, .footer, .footer-buttons,
          .image-wrapper, .image-container-multiple, .search-input-wrap, .search-bar,
          .tabs, .time-filter, .crop-container, .loading, .section, .quick-actions,
          .version-info, .download-card, .table-wrap, .table-container, .user-info,
          .conv-info, .item-info, .features, .feature-item, .stats, .hero,
          .text-message, .media-message, .recalled-message, .avatar,
          .message-item.other .message-content, .message-item.self .message-content,
          .info-card, .contact-info, .tabbar-container,
          [class*="card"], [class*="Card"], [class*="panel"], [class*="Panel"],
          [class*="section"], [class*="Section"], [class*="info"], [class*="Info"],
          [class*="item--"], [class*="form"], [class*="Form"], [class*="header"] {
            background: #0f172a !important; background-image: none !important;
          }
          text, view, span, p, label, h1, h2, h3, h4, h5, h6,
          div, input, textarea, button {
            color: #f1f5f9 !important;
          }
          .item-desc, .item-time, .tab-text, .user-class, .menu-count,
          .conv-time, .conv-preview, .stat-label, .guest-desc, .empty-text,
          .settings-arrow, .version-text, .search-placeholder, .menu-arrow,
          .avatar-tip, .version-label, .download-meta, .contact-label,
          [class*="desc"], [class*="Desc"], [class*="time"], [class*="Time"],
          [class*="sub"], [class*="Sub"], [class*="meta"], [class*="Meta"],
          [class*="label"], [class*="Label"] {
            color: #94a3b8 !important;
          }
          input, textarea, .input, .message-input, .search-input, .form-item input,
          .form-item textarea, .search-bar input {
            background: #0f172a !important; color: #f1f5f9 !important;
          }
          button, .btn, .submit-btn, .send-btn, .chat-btn, .edit-btn,
          .login-btn, .guest-btn, .download-btn, .confirm-btn, .context-menu-item,
          .publish-btn, .solve-btn, .delete-btn, .unblock-btn, .retry-btn,
          .btn-primary, .btn-ok, .btn-info, .btn-p, .btn-s, .btn-danger, .btn-del,
          .btn-secondary, .btn-outline, .btn-warn, .apply-btn, .crop-btn,
          [class*="btn"], [class*="Btn"] {
            background: #334155 !important; background-image: none !important;
            color: #f1f5f9 !important;
          }
          .solve-btn, .btn-success { background: #065f46 !important; background-image: none !important; }
          .delete-btn, .btn-danger, .btn-del, .unblock-btn { background: #7f1d1d !important; background-image: none !important; }
          button[disabled] { opacity: 0.4 !important; }
          .tab-item, .time-filter-item { background: #334155 !important; color: #94a3b8 !important; }
          .tab-item.active, .time-filter-item.active { background: #475569 !important; color: #f1f5f9 !important; }
          .unread-badge, .tab-badge { background: #ef4444 !important; color: #fff !important; }
          .avatar, .avatar-placeholder { border-color: #334155 !important; background: #334155 !important; }
          .avatar-text, .avatar-icon { color: #94a3b8 !important; }
          .stat-divider, .menu-divider, hr { background: #334155 !important; }
          .empty-icon { opacity: 0.4 !important; }
          .empty-text, .empty-state { color: #475569 !important; }
          .item-tag.lost { color: #fbbf24 !important; background: rgba(251,191,36,0.15) !important; }
          .item-tag.found { color: #94a3b8 !important; background: rgba(148,163,184,0.15) !important; }
          .status-tag.solved { color: #6ee7b7 !important; background: rgba(110,231,183,0.15) !important; }
          .mask, .mask-top, .mask-bottom, .mask-left, .mask-right { background: rgba(0,0,0,0.7) !important; }
          switch { background: #334155 !important; }
          .custom-tabbar { background: #0f172a !important; border-top-color: #334155 !important; }
          .tab-bar-item .tab-text { color: #64748b !important; }
          .tab-bar-item.active .tab-text { color: #f1f5f9 !important; }
          .crop-area { border-color: rgba(255,255,255,0.3) !important; }
          .corner { border-color: rgba(255,255,255,0.6) !important; }
          .grid-line { background: rgba(255,255,255,0.1) !important; }
          .message-item.self .message-content { background: #334155 !important; }
          .message-item.other .message-content { background: #0f172a !important; }
          .search-placeholder { color: #94a3b8 !important; }
          .tab-icon, .menu-icon, .settings-icon { color: inherit !important; }
          .menu-item.logout { border-top-color: #334155 !important; }
          .ico-home, .ico-chat, .ico-person { border-color: #94a3b8 !important; }
          .ico-home::before { border-bottom-color: #94a3b8 !important; }
          .ico-chat::after { border-top-color: #94a3b8 !important; }
          .ico-person::after { border-color: #94a3b8 !important; }
          .ico-plus { color: #94a3b8 !important; }
          .tab-bar-item.active .ico-home, .tab-bar-item.active .ico-chat,
          .tab-bar-item.active .ico-person { border-color: #f1f5f9 !important; }
          .tab-bar-item.active .ico-home::before { border-bottom-color: #f1f5f9 !important; }
          .tab-bar-item.active .ico-chat::after { border-top-color: #f1f5f9 !important; }
          .tab-bar-item.active .ico-person::after { border-color: #f1f5f9 !important; }
          .tab-bar-item.active .ico-plus { color: #f1f5f9 !important; }
        `
          document.head.appendChild(s)
          document.body.classList.add('theme-dark')
        }
        // 重试注入，确保 DOM 就绪
        const tryInject = () => { if (!document.head) setTimeout(tryInject, 200); else inject() }
        setTimeout(tryInject, 400)
      } else {
        document.body.classList.remove('theme-dark')
      }
      // #endif
    }
  }
}
</script>

<style lang="scss">
  @import '@/uni_modules/uni-scss/index.scss';
  /* #ifndef APP-NVUE */
  @import '@/static/customicons.css';

  page { background-color: #f8f9fa; }
  /* #ifdef APP-PLUS */
  .uni-app--showleftwindow, .uni-page-body, .uni-app,
  uni-page-wrapper, uni-page-body { background-color: #f8f9fa !important; }
  /* #endif */
  /* #endif */
</style>
