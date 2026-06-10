let notificationChannelCreated = false
const CHANNEL_ID = 'lost_found_msg_channel'
const CHANNEL_NAME = '新消息通知'
const NOTIFICATION_ID_BASE = 10000

// 消息去重：记录最近显示过通知的消息ID
const shownMessages = new Set()
const MAX_SHOWN_MESSAGES = 100

export const notification = {
  init() {
    if (notificationChannelCreated) return
    this._createNotificationChannel()
  },

  _createNotificationChannel() {
    // #ifdef APP-PLUS
    try {
      if (typeof plus === 'undefined' || !plus.android) {
        return
      }

      const main = plus.android.runtimeMainActivity()
      const Build = plus.android.importClass('android.os.Build')
      const Context = plus.android.importClass('android.content.Context')
      const NotificationManager = plus.android.importClass('android.app.NotificationManager')
      const Uri = plus.android.importClass('android.net.Uri')

      const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)

      if (Build.VERSION.SDK_INT >= 26) {
        // 删除旧渠道，重新创建以确保配置正确
        nm.deleteNotificationChannel(CHANNEL_ID)
        
        const NotificationChannel = plus.android.importClass('android.app.NotificationChannel')
        const channel = new NotificationChannel(
          CHANNEL_ID,
          CHANNEL_NAME,
          NotificationManager.IMPORTANCE_HIGH  // 高重要性，确保弹出通知
        )
        
        // 配置通知渠道
        channel.enableVibration(true)
        channel.setVibrationPattern([0, 500, 200, 500])  // 振动模式
        channel.setShowBadge(true)  // 显示角标
        channel.enableLights(true)  // 呼吸灯
        channel.setLightColor(0xFF00FF00)  // 绿色呼吸灯
        channel.setLockscreenVisibility(1)  // 锁屏显示完整内容
        channel.setDescription('接收新消息通知')
        channel.setBypassDnd(true)  // 绕过勿扰模式
        
        // 设置通知声音（使用系统默认通知声音）
        const RingtoneManager = plus.android.importClass('android.media.RingtoneManager')
        const defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        channel.setSound(defaultSoundUri, null)
        
        nm.createNotificationChannel(channel)
        console.log('Android 原生通知渠道创建成功')
      }

      notificationChannelCreated = true
    } catch (e) {
      console.error('创建通知渠道失败:', e)
    }
    // #endif
  },

  /**
   * 显示 Android 原生系统通知
   * 使用 NotificationCompat.Builder 构建通知
   */
  showMessageNotification(userId, userName, content, avatarUrl = '', messageId = '') {
    // #ifdef APP-PLUS
    try {
      console.log('[通知] showMessageNotification 被调用:', {userId, userName, content, messageId})
      
      if (typeof plus === 'undefined' || !plus.android) {
        console.log('[通知] 不是 Android 环境，跳过')
        return
      }

      // 消息去重检查
      const msgKey = messageId || `${userId}_${Date.now()}`
      if (shownMessages.has(msgKey)) {
        console.log('[通知] 消息已显示过，跳过去重')
        return
      }
      
      // 记录已显示的消息
      shownMessages.add(msgKey)
      if (shownMessages.size > MAX_SHOWN_MESSAGES) {
        const arr = Array.from(shownMessages)
        arr.slice(0, 50).forEach(key => shownMessages.delete(key))
      }

      // 确保通知渠道已创建
      console.log('[通知] 初始化通知渠道')
      this.init()

      const main = plus.android.runtimeMainActivity()
      console.log('[通知] 获取到主 Activity')
      
      // 导入 Android 原生类
      const Context = plus.android.importClass('android.content.Context')
      const Intent = plus.android.importClass('android.content.Intent')
      const PendingIntent = plus.android.importClass('android.app.PendingIntent')
      const NotificationCompat = plus.android.importClass('androidx.core.app.NotificationCompat')
      const NotificationManagerCompat = plus.android.importClass('androidx.core.app.NotificationManagerCompat')
      const Build = plus.android.importClass('android.os.Build')

      // 确保用户名和内容有效
      const displayName = (userName && userName.trim()) ? userName.trim() : '用户'
      const displayContent = (content && content.trim()) ? content.trim() : '新消息'
      
      console.log('[通知] 显示内容:', displayName, '-', displayContent)

      // 创建点击通知后的 Intent
      const packageName = main.getPackageName()
      console.log('[通知] 应用包名:', packageName)
      
      const launchIntent = main.getPackageManager().getLaunchIntentForPackage(packageName)
      console.log('[通知] 获取 Launch Intent:', launchIntent ? '成功' : '失败')
      
      if (launchIntent) {
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
        launchIntent.putExtra('userId', String(userId))
        launchIntent.putExtra('userName', displayName)
        launchIntent.putExtra('fromNotification', true)
      }

      // 创建 PendingIntent
      const flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_IMMUTABLE : 0)
      console.log('[通知] PendingIntent flags:', flags)
      
      const pendingIntent = PendingIntent.getActivity(
        main,
        parseInt(userId) || Date.now(),
        launchIntent,
        flags
      )

      // 使用 Android 原生 NotificationCompat.Builder 构建通知
      const builder = new NotificationCompat.Builder(main, CHANNEL_ID)
      
      // 设置通知基本属性
      builder.setContentTitle(displayName)
      builder.setContentText(displayContent)
      builder.setSmallIcon(17301590)  // 系统默认图标
      builder.setContentIntent(pendingIntent)
      builder.setAutoCancel(true)  // 点击后自动取消
      
      // 设置通知优先级和可见性
      builder.setPriority(NotificationCompat.PRIORITY_MAX)  // 最高优先级
      builder.setDefaults(NotificationCompat.DEFAULT_ALL)  // 默认声音、振动、灯光
      builder.setCategory(NotificationCompat.CATEGORY_MESSAGE)  // 消息类别
      builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)  // 锁屏可见
      
      // 设置通知行为
      builder.setOnlyAlertOnce(false)  // 每次都提醒
      builder.setTicker(displayContent)  // 滚动提示
      
      // 设置大图标和样式（展开显示完整内容）
      builder.setStyle(new NotificationCompat.BigTextStyle().bigText(displayContent))
      
      // 设置时间和计数
      builder.setWhen(Date.now())
      builder.setShowWhen(true)
      
      // 添加操作按钮（可选）
      builder.setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)

      // 使用 NotificationManagerCompat 发送通知
      const nm = NotificationManagerCompat.from(main)
      const notificationId = NOTIFICATION_ID_BASE + (parseInt(userId) % 10000 || 0)
      console.log('[通知] 通知 ID:', notificationId)
      
      // 发送通知
      nm.notify(notificationId, builder.build())

      console.log('[通知] Android 原生通知发送成功')
      return notificationId
      
    } catch (e) {
      console.error('[通知] Android 原生通知发送失败:', e)
      return null
    }
    // #endif
  },

  /**
   * 取消指定通知
   */
  cancelNotification(notificationId) {
    // #ifdef APP-PLUS
    try {
      if (typeof plus === 'undefined' || !plus.android) {
        return
      }

      const main = plus.android.runtimeMainActivity()
      const Context = plus.android.importClass('android.content.Context')
      const NotificationManager = plus.android.importClass('android.app.NotificationManager')

      const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)
      nm.cancel(notificationId)
      console.log('通知已取消:', notificationId)
    } catch (e) {
      console.error('取消通知失败:', e)
    }
    // #endif
  },

  /**
   * 取消所有通知
   */
  cancelAllNotifications() {
    // #ifdef APP-PLUS
    try {
      if (typeof plus === 'undefined' || !plus.android) {
        return
      }

      const main = plus.android.runtimeMainActivity()
      const Context = plus.android.importClass('android.content.Context')
      const NotificationManager = plus.android.importClass('android.app.NotificationManager')

      const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)
      nm.cancelAll()
      console.log('所有通知已取消')
    } catch (e) {
      console.error('取消所有通知失败:', e)
    }
    // #endif
  },

  /**
   * 检查通知权限
   */
  areNotificationsEnabled() {
    // #ifdef APP-PLUS
    try {
      if (typeof plus === 'undefined' || !plus.android) {
        return false
      }

      const main = plus.android.runtimeMainActivity()
      const NotificationManagerCompat = plus.android.importClass('androidx.core.app.NotificationManagerCompat')
      const nm = NotificationManagerCompat.from(main)
      return nm.areNotificationsEnabled()
    } catch (e) {
      console.error('检查通知权限失败:', e)
      return false
    }
    // #endif
    return false
  },

  /**
   * 请求通知权限
   */
  requestPermission() {
    // #ifdef APP-PLUS
    return new Promise((resolve) => {
      try {
        if (typeof plus === 'undefined' || !plus.android) {
          resolve(false)
          return
        }

        const main = plus.android.runtimeMainActivity()
        const Build = plus.android.importClass('android.os.Build')

        // 检查是否已授权
        if (this.areNotificationsEnabled()) {
          resolve(true)
          return
        }

        // Android 13+ 需要请求通知权限
        if (Build.VERSION.SDK_INT >= 33) {
          const Intent = plus.android.importClass('android.content.Intent')
          const Settings = plus.android.importClass('android.provider.Settings')
          const Uri = plus.android.importClass('android.net.Uri')
          
          const intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
          intent.putExtra(Settings.EXTRA_APP_PACKAGE, main.getPackageName())
          intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          main.startActivity(intent)
          resolve(false)
        } else {
          resolve(true)
        }
      } catch (e) {
        console.error('请求通知权限失败:', e)
        resolve(false)
      }
    })
    // #endif
    return Promise.resolve(false)
  }
}