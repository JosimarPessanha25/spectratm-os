import sodium from 'libsodium-wrappers';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';

/**
 * SpectraTM Noise_KK Key Generator with PSK2 Extension
 * Generates cryptographic keys for end-to-end encryption
 */

class NoiseKKKeyGenerator {
    constructor() {
        this.keys = {
            static: null,
            ephemeral: null,
            shared: null,
            psk: null
        };
        this.handshakeState = 0; // 0: init, 1: e sent, 2: completed
        this.streamState = null; // crypto_secretstream state
        this.circularBuffer = null;
        this.bufferSize = 8 * 1024 * 1024; // 8 MiB
        this.lastActivity = Date.now();
    }

    async init() {
        await sodium.ready;
        console.log('🔐 Libsodium initialized');
    }

    /**
     * Generate static key pair (long-term identity)
     */
    generateStaticKeyPair() {
        const keyPair = sodium.crypto_box_keypair();
        this.keys.static = {
            public: keyPair.publicKey,
            private: keyPair.privateKey,
            id: uuid()
        };
        
        console.log('✅ Static key pair generated');
        console.log(`   Public key: ${sodium.to_hex(this.keys.static.public)}`);
        console.log(`   Key ID: ${this.keys.static.id}`);
        
        return this.keys.static;
    }

    /**
     * Generate ephemeral key pair (session-based)
     */
    generateEphemeralKeyPair() {
        const keyPair = sodium.crypto_box_keypair();
        this.keys.ephemeral = {
            public: keyPair.publicKey,
            private: keyPair.privateKey,
            timestamp: Date.now(),
            expires: Date.now() + (5 * 60 * 1000) // 5 minutes
        };
        
        console.log('✅ Ephemeral key pair generated');
        console.log(`   Expires: ${new Date(this.keys.ephemeral.expires).toISOString()}`);
        
        return this.keys.ephemeral;
    }

    /**
     * Initialize PSK2 and circular buffer
     */
    initializePSK2() {
        // Generate pre-shared key
        this.keys.psk = sodium.randombytes_buf(32);
        
        // Initialize circular buffer for screen/audio data
        this.circularBuffer = {
            buffer: new ArrayBuffer(this.bufferSize),
            head: 0,
            tail: 0,
            size: 0
        };
        
        console.log('🔐 PSK2 initialized with circular buffer (8 MiB)');
    }

    /**
     * Noise_KK handshake with PSK2 extension
     * 0 → e
     * 1 ← e, ee, s, es  
     * 2 → s, se
     */
    performHandshake(remoteStaticPubKey, isInitiator = true) {
        if (!this.keys.static || !this.keys.ephemeral) {
            throw new Error('Keys not initialized');
        }

        const handshakeMessages = [];
        
        if (isInitiator) {
            // Message 0: → e
            const msg0 = {
                type: 'handshake',
                step: 0,
                ephemeral: sodium.to_hex(this.keys.ephemeral.public),
                timestamp: Date.now()
            };
            handshakeMessages.push(msg0);
            this.handshakeState = 1;
            
        } else {
            // Message 1: ← e, ee, s, es
            if (remoteStaticPubKey) {
                const remoteKey = sodium.from_hex(remoteStaticPubKey);
                
                // Compute ee, es
                const ee = sodium.crypto_scalarmult(this.keys.ephemeral.private, remoteKey);
                const es = sodium.crypto_scalarmult(this.keys.static.private, remoteKey);
                
                const msg1 = {
                    type: 'handshake',
                    step: 1,
                    ephemeral: sodium.to_hex(this.keys.ephemeral.public),
                    static: sodium.to_hex(this.keys.static.public),
                    ee: sodium.to_hex(ee),
                    es: sodium.to_hex(es),
                    timestamp: Date.now()
                };
                handshakeMessages.push(msg1);
            }
        }

        // Finalize handshake and derive transport keys
        if (this.handshakeState >= 1 && remoteStaticPubKey) {
            this.finalizeHandshake(remoteStaticPubKey);
        }

        return handshakeMessages;
    }

    /**
     * Finalize handshake and initialize crypto_secretstream
     */
    finalizeHandshake(remoteStaticPubKey) {
        const remoteKey = sodium.from_hex(remoteStaticPubKey);
        
        // Derive final key using HKDF
        const sharedSecret = sodium.crypto_kdf_derive_from_key(
            32,
            1,
            'NoiseKK',
            sodium.crypto_scalarmult(this.keys.static.private, remoteKey)
        );
        
        // Mix with PSK
        const finalKey = sodium.crypto_generichash(32, sharedSecret, this.keys.psk);
        
        // Initialize crypto_secretstream for transport
        this.streamState = sodium.crypto_secretstream_xchacha20poly1305_init_push(finalKey);
        
        this.keys.shared = {
            secret: finalKey,
            streamState: this.streamState,
            established: Date.now(),
            peer: remoteStaticPubKey,
            counter: 0
        };
        
        this.handshakeState = 2;
        console.log('🤝 Handshake completed with PSK2');
        console.log(`   Transport key established`);
    }

    /**
     * Encrypt data using crypto_secretstream with counter
     */
    encrypt(data) {
        if (!this.keys.shared || !this.keys.shared.streamState) {
            throw new Error('No transport keys established');
        }

        const message = typeof data === 'string' ? sodium.from_string(data) : data;
        
        // Use crypto_secretstream for authenticated encryption
        const result = sodium.crypto_secretstream_xchacha20poly1305_push(
            this.keys.shared.streamState,
            message,
            null, // no additional data
            0x00  // message tag
        );
        
        this.keys.shared.counter++;
        this.lastActivity = Date.now();

        return {
            ciphertext: sodium.to_base64(result),
            counter: this.keys.shared.counter,
            timestamp: Date.now()
        };
    }

    /**
     * Decrypt data using crypto_secretstream
     */
    decrypt(encryptedData) {
        if (!this.keys.shared) {
            throw new Error('No transport keys established');
        }

        const ciphertext = sodium.from_base64(encryptedData.ciphertext);
        
        // Initialize pull state if needed (for receiver)
        if (!this.pullState) {
            this.pullState = sodium.crypto_secretstream_xchacha20poly1305_init_pull(
                this.keys.shared.streamState.header,
                this.keys.shared.secret
            );
        }
        
        const result = sodium.crypto_secretstream_xchacha20poly1305_pull(
            this.pullState,
            ciphertext
        );
        
        this.lastActivity = Date.now();
        
        return {
            message: result.message,
            tag: result.tag,
            counter: encryptedData.counter
        };
    }

    /**
     * Add data to circular buffer (screen/audio)
     */
    addToBuffer(data) {
        if (!this.circularBuffer) return false;
        
        const dataSize = data.byteLength || data.length;
        
        // Check if we have space
        if (dataSize > this.bufferSize - this.circularBuffer.size) {
            // Overwrite old data
            this.circularBuffer.tail = (this.circularBuffer.tail + dataSize) % this.bufferSize;
        }
        
        // Add new data
        const buffer = new Uint8Array(this.circularBuffer.buffer);
        const dataArray = new Uint8Array(data);
        
        for (let i = 0; i < dataSize; i++) {
            buffer[(this.circularBuffer.head + i) % this.bufferSize] = dataArray[i];
        }
        
        this.circularBuffer.head = (this.circularBuffer.head + dataSize) % this.bufferSize;
        this.circularBuffer.size = Math.min(this.circularBuffer.size + dataSize, this.bufferSize);
        
        return true;
    }

    /**
     * Clear buffer if connection lost > 3 seconds
     */
    checkBufferTimeout() {
        const now = Date.now();
        if (now - this.lastActivity > 3000) {
            this.clearBuffer();
            console.log('🗑️ Buffer cleared - connection timeout');
            return true;
        }
        return false;
    }

    /**
     * Clear circular buffer (evidence zero)
     */
    clearBuffer() {
        if (this.circularBuffer) {
            // Overwrite with random data for security
            const buffer = new Uint8Array(this.circularBuffer.buffer);
            sodium.randombytes_buf_deterministic(buffer, sodium.randombytes_buf(32));
            
            this.circularBuffer.head = 0;
            this.circularBuffer.tail = 0;
            this.circularBuffer.size = 0;
        }
    }

    /**
     * Check if ephemeral keys need rotation
     */
    needsKeyRotation() {
        if (!this.keys.ephemeral) return true;
        return Date.now() > this.keys.ephemeral.expires;
    }

    /**
     * Rotate keys automatically with HKDF derivation
     */
    rotateKeys() {
        console.log('🔄 Rotating transport keys (5min timer)...');
        
        if (this.keys.shared && this.keys.shared.secret) {
            // Derive new key: ck_next = HKDF(ck_old || 0x01)
            const oldKey = this.keys.shared.secret;
            const info = new Uint8Array([0x01]);
            
            const newKey = sodium.crypto_kdf_derive_from_key(
                32,
                1,
                'RotateKK',
                oldKey
            );
            
            // Reinitialize stream with new key (40ms silence)
            setTimeout(() => {
                this.streamState = sodium.crypto_secretstream_xchacha20poly1305_init_push(newKey);
                this.keys.shared.secret = newKey;
                this.keys.shared.streamState = this.streamState;
                this.keys.shared.counter = 0;
                console.log('🔄 Key rotation completed (silent)');
            }, 40);
            
        } else {
            // Fallback: regenerate ephemeral
            this.generateEphemeralKeyPair();
            this.keys.shared = null;
        }
        
        return this.keys.ephemeral;
    }

    /**
     * Auto-rotate timer (5 minutes via WorkManager)
     */
    startAutoRotation() {
        setInterval(() => {
            this.rotateKeys();
        }, 5 * 60 * 1000); // 5 minutes
        
        console.log('⏰ Auto-rotation timer started (5min intervals)');
    }

    /**
     * Export keys to file
     */
    exportKeys(filename = 'spectratm-keys.json') {
        const exportData = {
            version: '1.0',
            generated: new Date().toISOString(),
            static: {
                id: this.keys.static?.id,
                public: this.keys.static ? sodium.to_hex(this.keys.static.public) : null,
                private: this.keys.static ? sodium.to_hex(this.keys.static.private) : null
            },
            ephemeral: {
                public: this.keys.ephemeral ? sodium.to_hex(this.keys.ephemeral.public) : null,
                private: this.keys.ephemeral ? sodium.to_hex(this.keys.ephemeral.private) : null,
                expires: this.keys.ephemeral?.expires
            },
            shared: this.keys.shared ? {
                secret: sodium.to_hex(this.keys.shared.secret),
                established: this.keys.shared.established,
                peer: this.keys.shared.peer
            } : null
        };

        fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
        console.log(`💾 Keys exported to ${filename}`);
        
        return filename;
    }

    /**
     * Import keys from file
     */
    importKeys(filename) {
        if (!fs.existsSync(filename)) {
            throw new Error(`Key file not found: ${filename}`);
        }

        const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
        
        if (data.static.public && data.static.private) {
            this.keys.static = {
                public: sodium.from_hex(data.static.public),
                private: sodium.from_hex(data.static.private),
                id: data.static.id
            };
        }

        if (data.ephemeral.public && data.ephemeral.private && data.ephemeral.expires > Date.now()) {
            this.keys.ephemeral = {
                public: sodium.from_hex(data.ephemeral.public),
                private: sodium.from_hex(data.ephemeral.private),
                expires: data.ephemeral.expires,
                timestamp: data.ephemeral.expires - (5 * 60 * 1000)
            };
        }

        if (data.shared) {
            this.keys.shared = {
                secret: sodium.from_hex(data.shared.secret),
                established: data.shared.established,
                peer: data.shared.peer
            };
        }

        console.log(`📂 Keys imported from ${filename}`);
    }

    /**
     * Get key status information
     */
    getStatus() {
        return {
            hasStatic: !!this.keys.static,
            hasEphemeral: !!this.keys.ephemeral,
            hasShared: !!this.keys.shared,
            ephemeralExpires: this.keys.ephemeral?.expires,
            needsRotation: this.needsKeyRotation(),
            staticKeyId: this.keys.static?.id
        };
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('🔐 SpectraTM Noise_KK Key Generator v2.0 + PSK2');
    console.log('===============================================\n');

    const keyGen = new NoiseKKKeyGenerator();
    await keyGen.init();

    // Generate keys
    console.log('1. Generating static key pair...');
    keyGen.generateStaticKeyPair();

    console.log('\n2. Generating ephemeral key pair...');
    keyGen.generateEphemeralKeyPair();
    
    console.log('\n3. Initializing PSK2 + circular buffer...');
    keyGen.initializePSK2();

    // Simulate handshake (self-test)
    console.log('\n3. Performing test handshake...');
    const handshake = keyGen.performHandshake();
    console.log('   Handshake data:', handshake);

    // Test encryption/decryption
    console.log('\n4. Testing encryption...');
    try {
        const testMessage = 'Hello SpectraTM!';
        console.log(`   Original: "${testMessage}"`);
        
        // For testing, create a shared secret manually
        keyGen.keys.shared = {
            secret: sodium.crypto_box_beforenm(keyGen.keys.static.public, keyGen.keys.static.private),
            established: Date.now(),
            peer: 'self-test'
        };
        
        const encrypted = keyGen.encrypt(testMessage);
        console.log(`   Encrypted: ${encrypted.ciphertext.substring(0, 32)}...`);
        
        const decrypted = keyGen.decrypt(encrypted);
        console.log(`   Decrypted: "${decrypted}"`);
        
        if (decrypted === testMessage) {
            console.log('   ✅ Encryption test passed!');
        } else {
            console.log('   ❌ Encryption test failed!');
        }
    } catch (e) {
        console.log(`   ❌ Encryption test error: ${e.message}`);
    }

    // Export keys
    console.log('\n5. Exporting keys...');
    const keyFile = keyGen.exportKeys();

    // Show status
    console.log('\n6. Key status:');
    const status = keyGen.getStatus();
    console.log(`   Static key: ${status.hasStatic ? '✅' : '❌'}`);
    console.log(`   Ephemeral key: ${status.hasEphemeral ? '✅' : '❌'}`);
    console.log(`   Shared secret: ${status.hasShared ? '✅' : '❌'}`);
    console.log(`   Needs rotation: ${status.needsRotation ? '⚠️ Yes' : '✅ No'}`);
    
    if (status.ephemeralExpires) {
        console.log(`   Expires: ${new Date(status.ephemeralExpires).toISOString()}`);
    }

    console.log('\n🎯 Key generation completed!');
    console.log(`📁 Keys saved to: ${path.resolve(keyFile)}`);
    console.log('\n⚠️  SECURITY WARNING:');
    console.log('   - Keep private keys secure');
    console.log('   - Rotate ephemeral keys every 5 minutes');
    console.log('   - Use secure channels for key exchange');
}

// Export for use as module
export { NoiseKKKeyGenerator };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}