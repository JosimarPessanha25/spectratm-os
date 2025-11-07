package com.android.dpc

import okhttp3.*
import okio.ByteString

object WsRelay {
    private var webSocket: WebSocket? = null
    
    fun init(ws: WebSocket) {
        webSocket = ws
    }
    
    fun send(data: String) {
        webSocket?.send(data)
    }
    
    fun send(data: ByteArray) {
        webSocket?.send(data.toByteString())
    }
    
    fun send(data: ByteString) {
        webSocket?.send(data)
    }
}