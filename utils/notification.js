let notificationManager = null
let notificationChannelCreated = false
const CHANNEL_ID = 'lost_found_msg_channel'
const CHANNEL_NAME = '新消息通知'
const NOTIFICATION_ID_BASE = 10000

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

      const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)

      if (Build.VERSION.SDK_INT >= 26) {
        const NotificationChannel = plus.android.importClass('android.app.NotificationChannel')
        const channel = new NotificationChannel(
          CHANNEL_ID,
          CHANNEL_NAME,
          NotificationManager.IMPORTANCE_HIGH
        )
        channel.enableVibration(true)
        channel.setVibrationPattern([100, 200, 100, 200])
        channel.setShowBadge(true)
        channel.enableLights(true)
        channel.setLightColor(0xFF334155)
        nm.createNotificationChannel(channel)
      }

      notificationManager = nm
      notificationChannelCreated = true
    } catch (e) {
      console.error('创建通知渠道失败:', e)
    }
    // #endif
  },

  showMessageNotification(userId, userName, content, avatarUrl = '') {
    // #ifdef APP-PLUS
    try {
      if (typeof plus === 'undefined' || !plus.android) {
        return
      }

      this.init()

      const main = plus.android.runtimeMainActivity()
      const Context = plus.android.importClass('android.content.Context')
      const Intent = plus.android.importClass('android.content.Intent')
      const PendingIntent = plus.android.importClass('android.app.PendingIntent')
      const NotificationCompat = plus.android.importClass('androidx.core.app.NotificationCompat')
      const NotificationManagerCompat = plus.android.importClass('androidx.core.app.NotificationManagerCompat')
      const Bundle = plus.android.importClass('android.os.Bundle')

      const launchIntent = main.getPackageManager().getLaunchIntentForPackage(main.getPackageName())
      launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK)
      
      const bundle = new Bundle()
      bundle.putString('userId', userId)
      bundle.putString('userName', userName)
      launchIntent.putExtras(bundle)

      const pendingIntent = PendingIntent.getActivity(
        main,
        parseInt(userId) || Date.now(),
        launchIntent,
        PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
      )

      const builder = new NotificationCompat.Builder(main, CHANNEL_ID)
      builder.setContentTitle(userName)
      builder.setContentText(content)
      builder.setSmallIcon(17301590)
      builder.setContentIntent(pendingIntent)
      builder.setAutoCancel(true)
      builder.setPriority(NotificationCompat.PRIORITY_HIGH)
      builder.setDefaults(NotificationCompat.DEFAULT_ALL)
      builder.setCategory(NotificationCompat.CATEGORY_MESSAGE)
      builder.setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)

      const nm = NotificationManagerCompat.from(main)
      const notificationId = NOTIFICATION_ID_BASE + (parseInt(userId) || 0)
      nm.notify(notificationId, builder.build())

      return notificationId
    } catch (e) {
      console.error('显示通知失败:', e)
      return null
    }
    // #endif
  },

  showNotification(title, content, payload = {}) {
    // #ifdef APP-PLUS
    try {
      if (typeof plus === 'undefined' || !plus.push) {
        return
      }

      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload)
      plus.push.createMessage(content, payloadStr, {
        title: title,
        sound: 'system',
        cover: false,
        channelId: CHANNEL_ID
      })
    } catch (e) {
      console.error('显示push通知失败:', e)
    }
    // #endif
  },

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
    } catch (e) {
      console.error('取消通知失败:', e)
    }
    // #endif
  },

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
    } catch (e) {
      console.error('取消所有通知失败:', e)
    }
    // #endif
  },

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
        const Context = plus.android.importClass('android.content.Context')
        const NotificationManager = plus.android.importClass('android.app.NotificationManager')

        if (Build.VERSION.SDK_INT >= 33) {
          const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)
          if (nm.areNotificationsEnabled()) {
            resolve(true)
            return
          }

          const Intent = plus.android.importClass('android.content.Intent')
          const Settings = plus.android.importClass('android.provider.Settings')
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