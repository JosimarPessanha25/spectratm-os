# SpectraTM v2.0 - Configuração Final de Deploy
# Gerado pelo bootstrap.sh com parâmetros fixos

# ============================================================================
# CONFIGURAÇÕES FIXAS (NÃO ALTERE)
# ============================================================================
DEVICE_ID_FIXED=f47ac10b58cc4372a2c5
TOKEN_FIXED=spec2024
PAYLOAD_256=f47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad

# ============================================================================
# URLS DE PRODUÇÃO
# ============================================================================
RENDER_APP_URL=https://sp-gate.onrender.com
WEBSOCKET_URL=wss://sp-gate.onrender.com/live
DASHBOARD_URL=https://sp-gate.onrender.com/dashboard

# ============================================================================
# CONFIGURAÇÕES DE SEGURANÇA
# ============================================================================
KEY_ROTATION_INTERVAL=300000
CIRCULAR_BUFFER_SIZE=1048576
MAX_EVIDENCE_AGE=600000
SESSION_TIMEOUT=1800000

# ============================================================================
# COMANDOS DE DEPLOYMENT
# ============================================================================

# 1. Build e Deploy Local
deploy_local() {
    echo "🚀 Iniciando deploy local..."
    cd control
    npm install
    npm run build
    node server.js
}

# 2. Deploy no Render
deploy_render() {
    echo "🌐 Deploy no Render..."
    git add .
    git commit -m "SpectraTM v2.0 - $(date +%Y%m%d_%H%M%S)"
    git push origin main
    echo "✅ Deploy automático via render.yaml"
}

# 3. Build APK Assinado
build_apk() {
    echo "📱 Build APK com assinatura..."
    cd android
    ./gradlew clean assembleRelease \
        -Pandroid.injected.signing.store.file=../spectra.jks \
        -Pandroid.injected.signing.store.password=$TOKEN_FIXED \
        -Pandroid.injected.signing.key.alias=spectra \
        -Pandroid.injected.signing.key.password=$TOKEN_FIXED
}

# 4. Ativação via ADB
activate_device() {
    echo "📲 Ativação do dispositivo..."
    adb wait-for-device
    adb install -r android/app/build/outputs/apk/release/app-release.apk
    adb shell dpm set-device-owner com.android.dpc/.CoreService
    adb shell am startservice com.android.dpc/.CoreService
    echo "✅ Dispositivo ativado"
}

# 5. Validação do Sistema
validate_system() {
    echo "🔍 Validando sistema..."
    
    # Check server
    if curl -s http://localhost:8000/health | grep -q "healthy"; then
        echo "✅ Servidor local OK"
    else
        echo "❌ Servidor local falhou"
    fi
    
    # Check Render deploy
    if curl -s https://sp-gate.onrender.com/health | grep -q "healthy"; then
        echo "✅ Deploy Render OK"
    else
        echo "❌ Deploy Render falhou"
    fi
    
    # Check APK
    if [ -f "android/app/build/outputs/apk/release/app-release.apk" ]; then
        echo "✅ APK encontrado"
        echo "📏 Tamanho: $(du -h android/app/build/outputs/apk/release/app-release.apk | cut -f1)"
    else
        echo "❌ APK não encontrado"
    fi
}

# 6. Deploy Completo
full_deploy() {
    echo "🚀 SpectraTM v2.0 - Deploy Completo"
    echo "=================================="
    
    build_apk
    deploy_render
    validate_system
    
    echo ""
    echo "✅ Deploy completo!"
    echo "🌐 Dashboard: https://sp-gate.onrender.com/dashboard"
    echo "📱 APK: android/app/build/outputs/apk/release/app-release.apk"
    echo "🔐 Device ID: $DEVICE_ID_FIXED"
    echo "🔑 Token: $TOKEN_FIXED"
}

# ============================================================================
# EXECUÇÃO BASEADA NO PARÂMETRO
# ============================================================================
case "${1:-help}" in
    local)
        deploy_local
        ;;
    render)
        deploy_render
        ;;
    apk)
        build_apk
        ;;
    activate)
        activate_device
        ;;
    validate)
        validate_system
        ;;
    full)
        full_deploy
        ;;
    *)
        echo "SpectraTM v2.0 - Deploy Manager"
        echo "================================"
        echo "Uso: $0 [comando]"
        echo ""
        echo "Comandos disponíveis:"
        echo "  local    - Deploy servidor local"
        echo "  render   - Deploy no Render"
        echo "  apk      - Build APK assinado"
        echo "  activate - Ativação via ADB"
        echo "  validate - Validar sistema"
        echo "  full     - Deploy completo"
        echo ""
        echo "Configurações:"
        echo "  Device ID: $DEVICE_ID_FIXED"
        echo "  Token: $TOKEN_FIXED"
        echo "  Dashboard: https://sp-gate.onrender.com/dashboard"
        ;;
esac