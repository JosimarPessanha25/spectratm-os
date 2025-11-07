package com.android.dpc

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.gson.Gson
import com.journeyapps.barcodescanner.CaptureManager
import com.journeyapps.barcodescanner.DecoratedBarcodeView
import com.journeyapps.barcodescanner.BarcodeCallback
import com.journeyapps.barcodescanner.BarcodeResult

class QRScannerActivity : AppCompatActivity() {
    private lateinit var barcodeView: DecoratedBarcodeView
    private lateinit var captureManager: CaptureManager
    private val gson = Gson()

    companion object {
        private const val TAG = "QRScanner"
        private const val CAMERA_PERMISSION_REQUEST_CODE = 201
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Check camera permission
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), CAMERA_PERMISSION_REQUEST_CODE)
        } else {
            initializeScanner()
        }
    }

    private fun initializeScanner() {
        barcodeView = DecoratedBarcodeView(this)
        barcodeView.setStatusText("Scan QR Code to connect to SpectraTM Server")
        
        setContentView(barcodeView)
        
        captureManager = CaptureManager(this, barcodeView)
        captureManager.initializeFromIntent(intent, savedInstanceState)
        captureManager.decode()

        barcodeView.decodeContinuous(object : BarcodeCallback {
            override fun barcodeResult(result: BarcodeResult) {
                handleQRResult(result.text)
            }

            override fun possibleResultPoints(resultPoints: MutableList<com.google.zxing.ResultPoint>?) {
                // Not used
            }
        })
    }

    private fun handleQRResult(qrData: String) {
        Log.d(TAG, "QR Code scanned: $qrData")
        
        try {
            // Parse QR data
            val connectionData = gson.fromJson(qrData, ConnectionData::class.java)
            
            if (connectionData.token != null && connectionData.serverUrl != null) {
                // Save connection data
                saveConnectionData(connectionData)
                
                // Show success and restart service
                Toast.makeText(this, "Connected! Token: ${connectionData.token}", Toast.LENGTH_SHORT).show()
                
                // Restart CoreService with new token
                val serviceIntent = Intent(this, CoreService::class.java)
                serviceIntent.putExtra("new_token", connectionData.token)
                serviceIntent.putExtra("server_url", connectionData.serverUrl)
                startForegroundService(serviceIntent)
                
                // Close scanner
                finish()
            } else {
                Toast.makeText(this, "Invalid QR Code format", Toast.LENGTH_SHORT).show()
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse QR code", e)
            Toast.makeText(this, "Invalid QR Code", Toast.LENGTH_SHORT).show()
        }
    }

    private fun saveConnectionData(connectionData: ConnectionData) {
        val prefs = getSharedPreferences("spectratm_config", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString("device_token", connectionData.token)
            putString("server_url", connectionData.serverUrl)
            putLong("connected_timestamp", System.currentTimeMillis())
            apply()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                initializeScanner()
            } else {
                Toast.makeText(this, "Camera permission required for QR scanning", Toast.LENGTH_LONG).show()
                finish()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (::captureManager.isInitialized) {
            captureManager.onResume()
        }
    }

    override fun onPause() {
        super.onPause()
        if (::captureManager.isInitialized) {
            captureManager.onPause()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::captureManager.isInitialized) {
            captureManager.onDestroy()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::captureManager.isInitialized) {
            captureManager.onSaveInstanceState(outState)
        }
    }

    data class ConnectionData(
        val token: String?,
        val serverUrl: String?,
        val timestamp: Long? = null,
        val expires: Long? = null
    )
}