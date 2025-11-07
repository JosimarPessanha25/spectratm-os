package com.android.dpc

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.*
import androidx.appcompat.app.AppCompatActivity

class ManualSetupActivity : AppCompatActivity() {
    
    companion object {
        private const val TAG = "ManualSetup"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Create UI programmatically
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(50, 50, 50, 50)
        }
        
        // Title
        val title = TextView(this).apply {
            text = "SpectraTM Device Setup"
            textSize = 24f
            setTextColor(android.graphics.Color.GREEN)
            setPadding(0, 0, 0, 40)
        }
        layout.addView(title)
        
        // Device ID input
        val deviceIdLabel = TextView(this).apply {
            text = "Device ID:"
            textSize = 16f
            setTextColor(android.graphics.Color.WHITE)
        }
        layout.addView(deviceIdLabel)
        
        val deviceIdInput = EditText(this).apply {
            hint = "3fae-b2c4-7a8f"
            textSize = 14f
            setTextColor(android.graphics.Color.WHITE)
            setHintTextColor(android.graphics.Color.GRAY)
            setBackgroundColor(android.graphics.Color.parseColor("#333333"))
            setPadding(20, 20, 20, 20)
        }
        layout.addView(deviceIdInput)
        
        // Token input
        val tokenLabel = TextView(this).apply {
            text = "Token:"
            textSize = 16f
            setTextColor(android.graphics.Color.WHITE)
            setPadding(0, 20, 0, 0)
        }
        layout.addView(tokenLabel)
        
        val tokenInput = EditText(this).apply {
            hint = "8L2Y"
            textSize = 14f
            setTextColor(android.graphics.Color.WHITE)
            setHintTextColor(android.graphics.Color.GRAY)
            setBackgroundColor(android.graphics.Color.parseColor("#333333"))
            setPadding(20, 20, 20, 20)
        }
        layout.addView(tokenInput)
        
        // Server URL (read-only)
        val serverLabel = TextView(this).apply {
            text = "Server URL:"
            textSize = 16f
            setTextColor(android.graphics.Color.WHITE)
            setPadding(0, 20, 0, 0)
        }
        layout.addView(serverLabel)
        
        val serverText = TextView(this).apply {
            text = "https://spectratm-os.onrender.com/live"
            textSize = 12f
            setTextColor(android.graphics.Color.GRAY)
            setBackgroundColor(android.graphics.Color.parseColor("#222222"))
            setPadding(20, 20, 20, 20)
        }
        layout.addView(serverText)
        
        // Connect button
        val connectButton = Button(this).apply {
            text = "Connect"
            textSize = 18f
            setTextColor(android.graphics.Color.BLACK)
            setBackgroundColor(android.graphics.Color.GREEN)
            setPadding(0, 30, 0, 30)
            
            setOnClickListener {
                val deviceId = deviceIdInput.text.toString().trim()
                val token = tokenInput.text.toString().trim()
                
                if (deviceId.isEmpty() || token.isEmpty()) {
                    Toast.makeText(this@ManualSetupActivity, "Please enter both Device ID and Token", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                
                // Save connection data
                saveConnectionData(deviceId, token)
                
                // Show success and restart service
                Toast.makeText(this@ManualSetupActivity, "Connected! Device: $deviceId", Toast.LENGTH_SHORT).show()
                
                // Restart CoreService
                val serviceIntent = Intent(this@ManualSetupActivity, CoreService::class.java)
                startForegroundService(serviceIntent)
                
                // Close activity
                finish()
            }
        }
        
        layout.addView(connectButton, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            topMargin = 40
        })
        
        // Set background
        layout.setBackgroundColor(android.graphics.Color.BLACK)
        setContentView(layout)
        
        Log.d(TAG, "Manual setup activity created")
    }
    
    private fun saveConnectionData(deviceId: String, token: String) {
        val prefs = getSharedPreferences("spectratm_config", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString("device_id", deviceId)
            putString("device_token", token)
            putString("server_url", "https://spectratm-os.onrender.com/live")
            putLong("connected_timestamp", System.currentTimeMillis())
            apply()
        }
        
        Log.d(TAG, "Connection data saved: $deviceId / $token")
    }
}