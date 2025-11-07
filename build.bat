@echo off
REM SpectraTM Build Script for Windows

echo 🔨 SpectraTM Build Script
echo ========================

REM Check dependencies
echo 📋 Checking dependencies...

REM Check Android SDK
adb version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Android SDK not found. Please install Android Studio.
    exit /b 1
)

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js.
    exit /b 1
)

echo ✅ Dependencies OK

REM Build Android APK
echo.
echo 📱 Building Android APK...
cd android
call gradlew.bat clean assembleRelease
if %errorlevel% equ 0 (
    echo ✅ APK built successfully
    echo 📄 Location: android\app\build\outputs\apk\release\app-release.apk
) else (
    echo ❌ APK build failed
    exit /b 1
)
cd ..

REM Install Node dependencies
echo.
echo 🌐 Installing server dependencies...
cd control
call npm install
if %errorlevel% equ 0 (
    echo ✅ Server dependencies installed
) else (
    echo ❌ Server dependency installation failed
    exit /b 1
)
cd ..

REM Generate encryption keys
echo.
echo 🔐 Generating encryption keys...
cd noise
call npm install
call npm run keygen
if %errorlevel% equ 0 (
    echo ✅ Encryption keys generated
) else (
    echo ❌ Key generation failed
    exit /b 1
)
cd ..

echo.
echo 🎉 Build completed successfully!
echo.
echo 📱 APK: android\app\build\outputs\apk\release\app-release.apk
echo 🌐 Server: cd control ^&^& npm start
echo 🔐 Keys: noise\spectratm-keys.json
echo.
echo ⚠️  Next steps:
echo    1. Install APK on target device
echo    2. Set as device owner: adb shell dpm set-device-owner com.android.dpc/.DeviceAdminReceiver
echo    3. Start server: cd control ^&^& npm start
echo    4. Open http://localhost:8000 in browser

pause