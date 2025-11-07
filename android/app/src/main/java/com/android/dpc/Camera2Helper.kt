package com.android.dpc

import android.content.Context
import android.hardware.camera2.*
import android.hardware.camera2.CameraCaptureSession.CaptureCallback
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Size
import android.view.Surface
import android.graphics.ImageFormat
import android.media.Image
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import java.nio.ByteBuffer

/**
 * Camera2 Helper for capturing images
 */
object Camera2Helper {
    private const val TAG = "Camera2Helper"
    private var cameraManager: CameraManager? = null
    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null
    private var onImageCaptured: ((Bitmap) -> Unit)? = null

    fun init(context: Context, callback: (Bitmap) -> Unit) {
        onImageCaptured = callback
        cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        
        startBackgroundThread()
        openCamera()
    }

    private fun startBackgroundThread() {
        backgroundThread = HandlerThread("CameraBackground").apply { start() }
        backgroundHandler = Handler(backgroundThread!!.looper)
    }

    private fun stopBackgroundThread() {
        backgroundThread?.quitSafely()
        try {
            backgroundThread?.join()
            backgroundThread = null
            backgroundHandler = null
        } catch (e: InterruptedException) {
            Log.e(TAG, "Error stopping background thread", e)
        }
    }

    private fun openCamera() {
        try {
            val cameraId = getCameraId() ?: return
            val characteristics = cameraManager?.getCameraCharacteristics(cameraId)
            val map = characteristics?.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            val outputSizes = map?.getOutputSizes(ImageFormat.JPEG)
            val size = outputSizes?.get(0) ?: Size(640, 480)

            imageReader = ImageReader.newInstance(size.width, size.height, ImageFormat.JPEG, 1)
            imageReader?.setOnImageAvailableListener(onImageAvailableListener, backgroundHandler)

            cameraManager?.openCamera(cameraId, stateCallback, backgroundHandler)
        } catch (e: SecurityException) {
            Log.e(TAG, "Camera permission denied", e)
        } catch (e: Exception) {
            Log.e(TAG, "Error opening camera", e)
        }
    }

    private fun getCameraId(): String? {
        return try {
            val cameraIds = cameraManager?.cameraIdList
            cameraIds?.firstOrNull { id ->
                val characteristics = cameraManager?.getCameraCharacteristics(id)
                val facing = characteristics?.get(CameraCharacteristics.LENS_FACING)
                facing == CameraCharacteristics.LENS_FACING_BACK
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting camera ID", e)
            null
        }
    }

    private val stateCallback = object : CameraDevice.StateCallback() {
        override fun onOpened(camera: CameraDevice) {
            cameraDevice = camera
            createCaptureSession()
        }

        override fun onDisconnected(camera: CameraDevice) {
            camera.close()
            cameraDevice = null
        }

        override fun onError(camera: CameraDevice, error: Int) {
            camera.close()
            cameraDevice = null
            Log.e(TAG, "Camera error: $error")
        }
    }

    private fun createCaptureSession() {
        try {
            val surfaces = listOf<Surface>(imageReader!!.surface)
            cameraDevice?.createCaptureSession(surfaces, sessionStateCallback, backgroundHandler)
        } catch (e: Exception) {
            Log.e(TAG, "Error creating capture session", e)
        }
    }

    private val sessionStateCallback = object : CameraCaptureSession.StateCallback() {
        override fun onConfigured(session: CameraCaptureSession) {
            captureSession = session
            startPeriodicCapture()
        }

        override fun onConfigureFailed(session: CameraCaptureSession) {
            Log.e(TAG, "Capture session configuration failed")
        }
    }

    private fun startPeriodicCapture() {
        backgroundHandler?.post {
            captureStillPicture()
            // Schedule next capture in 10 seconds
            backgroundHandler?.postDelayed({ startPeriodicCapture() }, 10000)
        }
    }

    private fun captureStillPicture() {
        try {
            val reader = imageReader ?: return
            val session = captureSession ?: return
            val device = cameraDevice ?: return

            val captureBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
            captureBuilder.addTarget(reader.surface)
            captureBuilder.set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)

            session.capture(captureBuilder.build(), captureCallback, backgroundHandler)
        } catch (e: Exception) {
            Log.e(TAG, "Error capturing still picture", e)
        }
    }

    private val captureCallback = object : CaptureCallback() {
        // Capture completed callback
    }

    private val onImageAvailableListener = ImageReader.OnImageAvailableListener { reader ->
        try {
            val image = reader.acquireLatestImage()
            val buffer = image.planes[0].buffer
            val bytes = ByteArray(buffer.remaining())
            buffer.get(bytes)
            
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            if (bitmap != null) {
                onImageCaptured?.invoke(bitmap)
            }
            
            image.close()
        } catch (e: Exception) {
            Log.e(TAG, "Error processing captured image", e)
        }
    }

    fun release() {
        captureSession?.close()
        captureSession = null
        
        cameraDevice?.close()
        cameraDevice = null
        
        imageReader?.close()
        imageReader = null
        
        stopBackgroundThread()
    }
}