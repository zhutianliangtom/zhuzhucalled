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
    uni.$on('theme-change', () => {
      this.applyTheme()
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
            if (plus.navigator.setNavigationBarColor) plus.navigator.setNavigationBarColor('#1a1a2e')
          } else {
            plus.navigator.setStatusBarStyle('dark')
            plus.navigator.setStatusBarBackground('#ffffff')
            if (plus.navigator.setNavigationBarColor) plus.navigator.setNavigationBarColor('#ffffff')
          }
        }
      } catch (e) {}
      // #endif

      // 直接操作 document page 元素，确保全局生效
      setTimeout(() => {
        const pageEl = document.querySelector('page') || document.body
        if (pageEl) {
          if (isDark) pageEl.classList.add('theme-dark')
          else pageEl.classList.remove('theme-dark')
        }
      }, 200)
    }
  }
}
</script>

<style lang="scss">
  /*每个页面公共css */
  @import '@/uni_modules/uni-scss/index.scss';
  /* #ifndef APP-NVUE */
  @import '@/static/customicons.css';

  // 默认浅色模式（与后台统一：#f8f9fa 背景）
  page { background-color: #f8f9fa; }
  /* #ifdef APP-PLUS */
  .uni-app--showleftwindow,
  .uni-page-body, .uni-app,
  uni-page-wrapper, uni-page-body { background-color: #f8f9fa !important; }
  /* #endif */

  // ========== 深色模式——全页面覆盖（!important 确保覆盖 Vue scoped 样式）==========
  // 配色与后台统一：#1e293b 侧栏 / #0f172a 卡片 / #334155 边框
  .theme-dark, page.theme-dark {
    &, .container, .content, .image-gallery, .conversation-list,
    .item-list, .settings-group, .user-list, .collection-list { background-color: #1e293b !important; }
    /* #ifdef APP-PLUS */
    .uni-app--showleftwindow, .uni-page-body, .uni-app,
    uni-page-wrapper, uni-page-body { background-color: #1e293b !important; }
    /* #endif */

    // 卡片 / 表单 / 列表项
    .item-card, .form, .menu-list, .menu-item, .conversation-item,
    .settings-list, .settings-item, .stats-section, .guest-card,
    .user-header, .detail-card, .publish-form, .info-card,
    .input-area, .input-tools, .context-menu, .search-content,
    view[class*="card"], view[class*="Card"], view[class*="panel"],
    view[class*="section"], view[class*="Section"] { background-color: #0f172a !important; }

    // 头部
    .header, .fixed-header, .user-header, .detail-header { background-color: #0f172a !important; }

    // 底部栏
    .tabbar-container .custom-tabbar, .footer {
      background-color: #0f172a !important;
      border-top-color: #334155 !important;
    }

    // 标题/重要文字
    .item-title, .title, .user-name, .label, .menu-text, .conv-name,
    .settings-text, .header-title, .detail-title, .guest-title,
    .contact-value, .item-desc, .text-message text, .user-detail text,
    view[class*="title"], view[class*="Title"],
    text[class*="title"], text[class*="Title"] { color: #f1f5f9 !important; }

    // 次要文字
    .item-time, .tab-text, .user-class, .menu-count,
    .conv-time, .conv-preview, .stat-label, .guest-desc, .empty-text,
    .settings-arrow, .version-text, .search-placeholder,
    .publish-time text, .time-text, .contact-label, .menu-arrow,
    view[class*="time"], view[class*="desc"], view[class*="Time"],
    text[class*="time"], text[class*="desc"], text[class*="Time"],
    text[class*="label"], text[class*="Label"] { color: #94a3b8 !important; }

    // 描述文字
    .item-desc, .conv-preview, text[class*="desc"], text[class*="Desc"] { color: #94a3b8 !important; }

    // 边框
    .input, .form-item input, .message-input, .publish-form input,
    .publish-form textarea, .form-item textarea {
      border-color: #334155 !important;
      background-color: #0f172a !important;
      color: #f1f5f9 !important;
    }

    // 搜索
    .search-bar, .search-input-wrap, .search-modal {
      background-color: #0f172a !important;
      border-color: #334155 !important;
    }
    .search-input, .search-bar input { color: #f1f5f9 !important; }

    // 标签/筛选按钮
    .tabs, .time-filter { background-color: #0f172a !important; border-bottom-color: #334155 !important; }
    .tab-item { color: #94a3b8 !important; }
    .time-filter-item { background-color: #334155 !important; color: #94a3b8 !important; }

    // 分隔线
    .stat-divider, .menu-divider, .divider { background-color: #334155 !important; }

    // 按钮
    .submit-btn, .send-btn, .chat-btn, .edit-btn, .login-btn,
    .guest-btn, .retry-btn, .download-btn { background-color: #2563eb !important; color: #fff !important; }
    .solve-btn { background-color: #10b981 !important; }
    .delete-btn, .unblock-btn { background-color: #ef4444 !important; }
    .btn[disabled], button[disabled] { opacity: 0.5 !important; }

    // 头像占位
    .avatar, .avatar-placeholder { border-color: #334155 !important; }
    .avatar-text, .avatar-icon { color: #94a3b8 !important; }

    // 底部操作栏
    .footer { background-color: #0f172a !important; }
    .footer-buttons { background-color: #0f172a !important; }

    // 空状态
    .empty-icon { opacity: 0.5 !important; }
    .empty-text, .empty-state { color: #64748b !important; }

    // 标签
    .item-tag, .tag, .status-tag { border-color: #334155 !important; }
    .item-tag.lost { color: #fbbf24 !important; background: rgba(251,191,36,0.1) !important; }
    .item-tag.found { color: #60a5fa !important; background: rgba(96,165,250,0.1) !important; }

    // 角标
    .unread-badge { background-color: #ef4444 !important; }
    .tab-badge { background-color: #ef4444 !important; }

    // 图库
    .image-wrapper, .image-container-multiple { background-color: #0f172a !important; }

    // 遮罩
    .mask-top, .mask-bottom, .mask-left, .mask-right { background-color: rgba(0,0,0,0.7) !important; }

    // 设置页 swiper/switch 底色
    switch { background-color: #334155 !important; }

    // 通用 view/text 兜底
    view, text { border-color: #334155; }
    text { color: #e2e8f0; }
    text[class*="secondary"], text[class*="Secondary"],
    text[class*="muted"], text[class*="Muted"] { color: #94a3b8 !important; }
  }
  /* #endif */
</style>
