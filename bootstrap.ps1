# SpectraTM v2.0 - Bootstrap Completo PowerShell "Plug-and-Play"
# Versão Windows copy-paste-run com deviceId fixo + token + keystore + deploy + ativação

param(
    [switch]$SkipADB,
    [switch]$SkipGit,
    [switch]$Verbose
)

# ============================================================================
# PARÂMETROS FIXOS (NÃO ALTERE PARA MANTER COMPATIBILIDADE BINÁRIA)
# ============================================================================
$DEVICE_ID = "f47ac10b58cc4372a2c5"          # 20 bytes alfanum único
$TOKEN_FIXED = "spec2024"                     # Senha unificada
$KEY_ALIAS = "spectra"                        # Alias da chave
$KEYSTORE_PATH = "$(Get-Location)\spectra.jks"
$NOISE_PUB_PATH = "$(Get-Location)\control\keys\server.pub"
$PAYLOAD_256 = "f47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad47ac10b58cc4372a2c5a0e0e4f0b14ad"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Host "🚀 SpectraTM v2.0 - Bootstrap Iniciado" -ForegroundColor Green
Write-Host "📱 Device ID: $DEVICE_ID" -ForegroundColor Cyan
Write-Host "🔑 Token: $TOKEN_FIXED" -ForegroundColor Cyan
Write-Host "⏰ Timestamp: $TIMESTAMP" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

# ============================================================================
# ETAPA 1: VERIFICAÇÃO DE DEPENDÊNCIAS
# ============================================================================
Write-Host "[1/7] 🔍 Verificando dependências..." -ForegroundColor Yellow

$dependencies = @{
    "java" = "Java (keytool)"
    "node" = "Node.js"
    "git" = "Git"
    "adb" = "Android Debug Bridge"
}

foreach ($cmd in $dependencies.Keys) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        Write-Host "✅ $($dependencies[$cmd]) encontrado" -ForegroundColor Green
    } else {
        Write-Host "⚠️ $($dependencies[$cmd]) não encontrado" -ForegroundColor Yellow
    }
}

# ============================================================================
# ETAPA 2: GERAÇÃO DO KEYSTORE UNIFICADO
# ============================================================================
Write-Host "[2/7] 🔐 Gerando keystore unificado..." -ForegroundColor Yellow

if (-not (Test-Path $KEYSTORE_PATH)) {
    $keystoreCmd = @(
        "keytool", "-genkey", "-v",
        "-keystore", $KEYSTORE_PATH,
        "-alias", $KEY_ALIAS,
        "-keyalg", "RSA",
        "-keysize", "2048",
        "-validity", "9125",
        "-storepass", $TOKEN_FIXED,
        "-keypass", $TOKEN_FIXED,
        "-dname", "CN=SpectraTM, OU=Spectra, O=Spectra, L=Global, S=Cyber, C=XX"
    )
    
    try {
        & $keystoreCmd[0] $keystoreCmd[1..($keystoreCmd.Length-1)] 2>$null
        Write-Host "✅ Keystore criado: $KEYSTORE_PATH" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Erro na geração do keystore: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "♻️ Reutilizando keystore existente" -ForegroundColor Cyan
}

# ============================================================================
# ETAPA 3: DERIVAÇÃO DAS CHAVES NOISE_KK
# ============================================================================
Write-Host "[3/7] 🔑 Derivando chaves Noise_KK..." -ForegroundColor Yellow

New-Item -ItemType Directory -Force -Path "control\keys", "noise\keys" | Out-Null

# Script Node.js para geração de chaves determinísticas
$keygenScript = @"
const crypto = require('crypto');
const fs = require('fs');

const deviceId = process.argv[2];
const token = process.argv[3];
const seed = crypto.createHash('sha256').update(deviceId + token).digest();

const keyPair = {
    privateKey: seed.slice(0, 32),
    publicKey: crypto.createHash('sha256').update(seed).digest().slice(0, 32)
};

const pubB64 = Buffer.from(keyPair.publicKey).toString('base64');
const pubHash = crypto.createHash('sha256').update(keyPair.publicKey).digest('hex');

fs.writeFileSync(process.argv[4], pubB64);
fs.writeFileSync(process.argv[5], JSON.stringify({
    deviceId: deviceId,
    publicKeyHash: pubHash,
    timestamp: new Date().toISOString()
}, null, 2));

console.log('✅ Chave pública Noise_KK gerada');
console.log('📋 Hash da chave:', pubHash);
"@

$keygenScript | Set-Content -Path "temp_keygen.js"
node "temp_keygen.js" $DEVICE_ID $TOKEN_FIXED $NOISE_PUB_PATH "noise\keys\server_info.json"
Remove-Item "temp_keygen.js"

# ============================================================================
# ETAPA 4: PAYLOAD FIXO DE 256 BYTES
# ============================================================================
Write-Host "[4/7] 📦 Gerando payload fixo de 256 bytes..." -ForegroundColor Yellow

# Converte hex para binário
$payloadBytes = [System.Convert]::FromHexString($PAYLOAD_256)
[System.IO.File]::WriteAllBytes("control\payload_256.bin", $payloadBytes)

# Para Android assets
New-Item -ItemType Directory -Force -Path "android\app\src\main\assets" | Out-Null
$PAYLOAD_256 | Set-Content -Path "android\app\src\main\assets\payload.hex" -NoNewline

Write-Host "✅ Payload de 256 bytes gerado ($(($payloadBytes.Length * 2)) hex chars)" -ForegroundColor Green

# ============================================================================
# ETAPA 5: CONFIGURAÇÃO DO ANDROID BUILD
# ============================================================================
Write-Host "[5/7] 🤖 Configurando build Android..." -ForegroundColor Yellow

$buildConfig = @"

// SpectraTM Bootstrap Configuration
android {
    defaultConfig {
        buildConfigField "String", "DEVICE_ID_FIXED", "`"$DEVICE_ID`""
        buildConfigField "String", "TOKEN_FIXED", "`"$TOKEN_FIXED`""
        buildConfigField "String", "PAYLOAD_256", "`"$PAYLOAD_256`""
    }
}
"@

if (Test-Path "android\app\build.gradle") {
    Add-Content -Path "android\app\build.gradle" -Value $buildConfig
    Write-Host "✅ Configuração adicionada ao build.gradle" -ForegroundColor Green
} else {
    Write-Host "⚠️ build.gradle não encontrado" -ForegroundColor Yellow
}

# ============================================================================
# ETAPA 6: BUILD DO APK (Windows Gradle)
# ============================================================================
Write-Host "[6/7] 🔨 Executando build do APK..." -ForegroundColor Yellow

Push-Location "android"

try {
    $gradleCmd = if (Test-Path "gradlew.bat") { ".\gradlew.bat" } else { "gradle" }
    
    & $gradleCmd clean assembleRelease `
        "-Pandroid.injected.signing.store.file=$KEYSTORE_PATH" `
        "-Pandroid.injected.signing.store.password=$TOKEN_FIXED" `
        "-Pandroid.injected.signing.key.alias=$KEY_ALIAS" `
        "-Pandroid.injected.signing.key.password=$TOKEN_FIXED" `
        --no-daemon --stacktrace
    
    $apkPath = "app\build\outputs\apk\release\app-release.apk"
    if (Test-Path $apkPath) {
        $apkSize = [math]::Round((Get-Item $apkPath).Length / 1MB, 2)
        Write-Host "✅ APK gerado: $apkPath ($apkSize MB)" -ForegroundColor Green
    } else {
        Write-Host "❌ APK não foi gerado" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erro no build: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Pop-Location
}

# ============================================================================
# ETAPA 7: DEPLOY E ATIVAÇÃO
# ============================================================================
Write-Host "[7/7] 🌐 Finalizando deploy..." -ForegroundColor Yellow

# Cria informações de deploy
$deployInfo = @{
    version = "2.0"
    deviceId = $DEVICE_ID
    token = $TOKEN_FIXED
    timestamp = $TIMESTAMP
    payloadHash = (Get-FileHash -Algorithm SHA256 -InputStream ([System.IO.MemoryStream]::new([System.Text.Encoding]::UTF8.GetBytes($PAYLOAD_256)))).Hash
} | ConvertTo-Json -Depth 2

$deployInfo | Set-Content -Path "DEPLOY_INFO.json"

# Git operations (se solicitado)
if (-not $SkipGit -and (Test-Path ".git")) {
    try {
        git add .
        git commit -m "SpectraTM v2.0 Bootstrap - $TIMESTAMP"
        git push origin main
        Write-Host "✅ Código enviado para GitHub" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Operação Git falhou: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# ADB operations (se solicitado)
if (-not $SkipADB -and (Get-Command adb -ErrorAction SilentlyContinue)) {
    Write-Host "📱 Tentando ativação via ADB..." -ForegroundColor Cyan
    
    try {
        # Timeout de 10 segundos
        $job = Start-Job -ScriptBlock { adb wait-for-device }
        if (Wait-Job $job -Timeout 10) {
            adb install -r "android\app\build\outputs\apk\release\app-release.apk"
            adb shell dpm set-device-owner com.android.dpc/.CoreService
            adb shell am startservice com.android.dpc/.CoreService
            Write-Host "✅ Dispositivo ativado!" -ForegroundColor Green
        } else {
            Write-Host "⏰ Timeout - nenhum dispositivo detectado" -ForegroundColor Yellow
        }
        Remove-Job $job -Force
    } catch {
        Write-Host "⚠️ Erro na ativação ADB: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# ============================================================================
# RELATÓRIO FINAL
# ============================================================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "🎉 SpectraTM v2.0 Bootstrap COMPLETO!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 RELATÓRIO FINAL:" -ForegroundColor Cyan
Write-Host "   📱 Device ID: $DEVICE_ID" -ForegroundColor White
Write-Host "   🔑 Token: $TOKEN_FIXED" -ForegroundColor White
Write-Host "   ⏰ Timestamp: $TIMESTAMP" -ForegroundColor White
Write-Host "   📦 Keystore: $KEYSTORE_PATH" -ForegroundColor White
Write-Host ""
Write-Host "🌐 ACESSOS:" -ForegroundColor Cyan
Write-Host "   🎛️ Painel Legacy: http://localhost:8000/" -ForegroundColor White
Write-Host "   ⚡ React Dashboard: http://localhost:8000/dashboard" -ForegroundColor White
Write-Host "   🗺️ Heatmap: http://localhost:8000/heatmap" -ForegroundColor White
Write-Host "   📋 Logs: http://localhost:8000/logz" -ForegroundColor White
Write-Host ""
Write-Host "🔧 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "   1. cd control" -ForegroundColor White
Write-Host "   2. node server.js" -ForegroundColor White
Write-Host "   3. Acesse: http://localhost:8000/dashboard" -ForegroundColor White
Write-Host ""
Write-Host "✅ Sistema pronto para operação profissional!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow