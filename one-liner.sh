#!/bin/bash

# 🔥 SpectraTM v2.0 One-Liner Bootstrap
# Detecta ambiente e instala automaticamente

set -e

# Parâmetros fixos padronizados
DEVICE_ID="f47ac10b58cc4372a2c5"
TOKEN="spec2024"
BASE_URL="https://spectratm-os.onrender.com"

echo "🚀 SpectraTM v2.0 One-Liner Bootstrap"

# OU Execute manualmente:

DEVICE_ID="f47ac10b58cc4372a2c5" TOKEN="spec2024" bash -c '
echo "🚀 SpectraTM v2.0 - Bootstrap Iniciado"
echo "📱 Device ID: $DEVICE_ID | 🔑 Token: $TOKEN"

# Keystore
keytool -genkey -v -keystore spectra.jks -alias spectra -keyalg RSA -keysize 2048 -validity 9125 -storepass $TOKEN -keypass $TOKEN -dname "CN=SpectraTM, OU=Spectra, O=Spectra, L=Global, S=Cyber, C=XX" 2>/dev/null

# Noise_KK Keys  
mkdir -p control/keys
node -e "
const crypto = require(\"crypto\");
const fs = require(\"fs\");
const seed = crypto.createHash(\"sha256\").update(\"$DEVICE_ID\" + \"$TOKEN\").digest();
const pub = crypto.createHash(\"sha256\").update(seed).digest().slice(0, 32);
fs.writeFileSync(\"control/keys/server.pub\", Buffer.from(pub).toString(\"base64\"));
console.log(\"✅ Chave Noise_KK:\", Buffer.from(pub).toString(\"hex\").substring(0, 16) + \"...\");
"

# APK Build
cd android 2>/dev/null && (./gradlew 2>/dev/null || gradle) assembleRelease -Pandroid.injected.signing.store.file=../spectra.jks -Pandroid.injected.signing.store.password=$TOKEN -Pandroid.injected.signing.key.alias=spectra -Pandroid.injected.signing.key.password=$TOKEN --no-daemon && echo "✅ APK: $(ls -lh app/build/outputs/apk/release/app-release.apk 2>/dev/null | awk \"{print \$5}\")" || echo "⚠️ APK build skipped"

# Server Start
cd ../control 2>/dev/null && npm install >/dev/null 2>&1 && node server.js &
SERVER_PID=$!

# Git Deploy
cd .. && git add . && git commit -m "SpectraTM-$(date +%H%M%S)" && git push origin main 2>/dev/null && echo "✅ Git push OK" || echo "⚠️ Git push skipped"

# ADB Install
adb wait-for-device 2>/dev/null && adb install -r android/app/build/outputs/apk/release/app-release.apk 2>/dev/null && adb shell dpm set-device-owner com.android.dpc/.CoreService 2>/dev/null && echo "✅ Device activated" || echo "⚠️ ADB skipped"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 SpectraTM v2.0 COMPLETO!"
echo "🌐 Dashboard: http://localhost:8000/dashboard"
echo "📱 Device ID: $DEVICE_ID"
echo "🔐 Token: $TOKEN"
echo "🔄 Server PID: $SERVER_PID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
'

# ============================================================================
# 📋 PAYLOAD FIXO DE 256 BYTES (HANDSHAKE VALIDATION)
# ============================================================================
# f47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad

# ============================================================================
# 🚀 COMANDOS RÁPIDOS ALTERNATIVOS
# ============================================================================

# Apenas server local:
# cd control && npm install && node server.js

# Apenas APK:  
# cd android && ./gradlew assembleRelease -Pandroid.injected.signing.store.password=spec2024

# Apenas deploy Git:
# git add . && git commit -m "deploy-$(date +%s)" && git push origin main

# Ativação ADB:
# adb install -r android/app/build/outputs/apk/release/app-release.apk && adb shell dpm set-device-owner com.android.dpc/.CoreService

# ============================================================================
# ✅ SISTEMA PRONTO - ACESSE: http://localhost:8000/dashboard
# ============================================================================