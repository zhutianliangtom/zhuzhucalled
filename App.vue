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
    
    // 设置全局深色模式
    this.setGlobalDarkMode()
    
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
        
        // 1. 申请忽略电池优化
        try {
          const powerManager = main.getSystemService(Context.POWER_SERVICE)
          const packageName = main.getPackageName()
          
          // 检查是否已添加到白名单
          if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
            console.log('申请忽略电池优化权限')
            const intent = new Intent()
            intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            intent.setData(Uri.parse('package:' + packageName))
            main.startActivity(intent)
          }
        } catch (e) {
          console.log('申请忽略电池优化失败:', e)
        }
        
        // 2. 创建前台通知（保活）
        this.createForegroundNotification()
        
        // 3. 设置定时唤醒
        this.setupWakeLock()
        
        // 4. 定时任务保持活跃
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
    
    // 申请通知权限
    requestNotificationPermission() {
      // #ifdef APP-PLUS
      try {
        if (typeof plus !== 'undefined' && plus) {
          if (plus.android) {
            // Android 平台
            const main = plus.android.runtimeMainActivity()
            const NotificationManager = plus.android.importClass('android.app.NotificationManager')
            const Build = plus.android.importClass('android.os.Build')
            
            if (Build.VERSION.SDK_INT >= 26) {
              // Android 8.0+ 申请通知渠道
              try {
                const NotificationChannel = plus.android.importClass('android.app.NotificationChannel')
                const Importance = plus.android.importClass('android.app.NotificationManager')
                const Context = plus.android.importClass('android.content.Context')
                
                const notificationManager = main.getSystemService(Context.NOTIFICATION_SERVICE)
                const channelId = 'lost_found_channel'
                const channelName = '失物招领通知'
                
                // 检查是否已创建渠道
                const channel = notificationManager.getNotificationChannel(channelId)
                if (!channel) {
                  const notificationChannel = new NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH)
                  notificationChannel.enableVibration(true)
                  notificationChannel.enableLights(true)
                  notificationManager.createNotificationChannel(notificationChannel)
                }
              } catch (e) {
                console.log('创建通知渠道失败:', e)
              }
            }
            
            // 检查通知权限
            const checkPermission = () => {
              try {
                const NotificationManagerCompat = plus.android.importClass('androidx.core.app.NotificationManagerCompat')
                const compat = NotificationManagerCompat.from(main)
                if (!compat.areNotificationsEnabled()) {
                  // 没有通知权限，引导用户去设置
                  uni.showModal({
                    title: '提示',
                    content: '请开启通知权限，以便接收新消息提醒',
                    confirmText: '去开启',
                    success: (res) => {
                      if (res.confirm) {
                        try {
                          const Intent = plus.android.importClass('android.content.Intent')
                          const Settings = plus.android.importClass('android.provider.Settings')
                          const Uri = plus.android.importClass('android.net.Uri')
                          
                          const intent = new Intent()
                          if (Build.VERSION.SDK_INT >= 26) {
                            intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                            intent.putExtra(Settings.EXTRA_APP_PACKAGE, main.getPackageName())
                          } else {
                            intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                            intent.setData(Uri.parse('package:' + main.getPackageName()))
                          }
                          main.startActivity(intent)
                        } catch (e2) {
                          console.log('跳转到设置失败:', e2)
                        }
                      }
                    }
                  })
                }
              } catch (e) {
                console.log('检查通知权限失败:', e)
              }
            }
            
            checkPermission()
          } else if (plus.ios) {
            // iOS 平台
            try {
              const UIApplication = plus.ios.import('UIApplication')
              const app = UIApplication.sharedApplication()
              const UNUserNotificationCenter = plus.ios.import('UNUserNotificationCenter')
              const center = UNUserNotificationCenter.currentNotificationCenter()
              
              // 请求通知权限
              center.requestAuthorizationWithOptionsCompletionHandler(
                (1 << 0) | (1 << 1) | (1 << 2), // 徽章、声音、提醒
                (granted, error) => {
                  console.log('iOS 通知权限申请结果:', granted)
                }
              )
            } catch (e) {
              console.log('iOS 申请通知权限失败:', e)
            }
          }
        }
      } catch (e) {
        console.error('申请通知权限失败:', e)
      }
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

  // 全局深色模式
  page {
    background-color: #0f0f1a;
  }

  // 修复底部导航栏白边 - 覆盖所有层级
  /* #ifdef APP-PLUS */
  .uni-app--showleftwindow,
  .uni-page-body,
  .uni-app,
  uni-page-wrapper,
  uni-page-body {
    background-color: #0f0f1a !important;
  }
  /* #endif */
  /* #endif */
</style>
