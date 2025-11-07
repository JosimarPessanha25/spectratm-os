#!/bin/bash

# SpectraTM Build Script
echo "🔨 SpectraTM Build Script"
echo "========================"

# Check dependencies
echo "📋 Checking dependencies..."

# Check Android SDK
if ! command -v adb &> /dev/null; then
    echo "❌ Android SDK not found. Please install Android Studio."
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js."
    exit 1
fi

echo "✅ Dependencies OK"

# Build Android APK
echo ""
echo "📱 Building Android APK..."
cd android
./gradlew clean assembleRelease
if [ $? -eq 0 ]; then
    echo "✅ APK built successfully"
    echo "📄 Location: android/app/build/outputs/apk/release/app-release.apk"
else
    echo "❌ APK build failed"
    exit 1
fi
cd ..

# Install Node dependencies
echo ""
echo "🌐 Installing server dependencies..."
cd control
npm install
if [ $? -eq 0 ]; then
    echo "✅ Server dependencies installed"
else
    echo "❌ Server dependency installation failed"
    exit 1
fi
cd ..

# Generate encryption keys
echo ""
echo "🔐 Generating encryption keys..."
cd noise
npm install
npm run keygen
if [ $? -eq 0 ]; then
    echo "✅ Encryption keys generated"
else
    echo "❌ Key generation failed"
    exit 1
fi
cd ..

echo ""
echo "🎉 Build completed successfully!"
echo ""
echo "📱 APK: android/app/build/outputs/apk/release/app-release.apk"
echo "🌐 Server: cd control && npm start"
echo "🔐 Keys: noise/spectratm-keys.json"
echo ""
echo "⚠️  Next steps:"
echo "   1. Install APK on target device"
echo "   2. Set as device owner: adb shell dpm set-device-owner com.android.dpc/.DeviceAdminReceiver"
echo "   3. Start server: cd control && npm start"
echo "   4. Open http://localhost:8000 in browser"