package com.android.dpc

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.util.Log

class BatteryOptimizer(private val context: Context, private val callback: (Boolean) -> Unit) {
    
    private var isCharging = false
    private var batteryLevel = 100
    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                Intent.ACTION_BATTERY_CHANGED -> {
                    handleBatteryChange(intent)
                }
                Intent.ACTION_POWER_CONNECTED -> {
                    isCharging = true
                    callback(true) // Aumentar para 10 Hz
                    Log.d("BatteryOptimizer", "Power connected - increasing sample rate")
                }
                Intent.ACTION_POWER_DISCONNECTED -> {
                    isCharging = false
                    callback(false) // Diminuir para 2 Hz
                    Log.d("BatteryOptimizer", "Power disconnected - decreasing sample rate")
                }
            }
        }
    }
    
    fun startMonitoring() {
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_BATTERY_CHANGED)
            addAction(Intent.ACTION_POWER_CONNECTED)
            addAction(Intent.ACTION_POWER_DISCONNECTED)
        }
        
        context.registerReceiver(batteryReceiver, filter)
        
        // Check initial state
        val batteryStatus = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        batteryStatus?.let { handleBatteryChange(it) }
    }
    
    fun stopMonitoring() {
        try {
            context.unregisterReceiver(batteryReceiver)
        } catch (e: Exception) {
            // Already unregistered
        }
    }
    
    private fun handleBatteryChange(intent: Intent) {
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        
        batteryLevel = (level * 100 / scale.toFloat()).toInt()
        isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || 
                    status == BatteryManager.BATTERY_STATUS_FULL
        
        // Ajusta frequência baseado na bateria
        val shouldHighFreq = isCharging || batteryLevel > 50
        callback(shouldHighFreq)
        
        Log.d("BatteryOptimizer", "Battery: ${batteryLevel}%, Charging: $isCharging, HighFreq: $shouldHighFreq")
    }
    
    fun getBatteryInfo(): Map<String, Any> {
        return mapOf(
            "level" to batteryLevel,
            "isCharging" to isCharging,
            "timestamp" to System.currentTimeMillis()
        )
    }
}