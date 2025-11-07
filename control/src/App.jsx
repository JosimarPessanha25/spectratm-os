import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import io from 'socket.io-client';
import './App.css';

// Components
import Dashboard from './components/Dashboard';
import DeviceDetail from './components/DeviceDetail';
import Heatmap from './components/Heatmap';
import LogViewer from './components/LogViewer';

const App = () => {
  const [socket, setSocket] = useState(null);
  const [devices, setDevices] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    const socketConnection = io(window.location.origin, {
      path: '/live',
      transports: ['websocket', 'polling']
    });

    socketConnection.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to SpectraTM server');
    });

    socketConnection.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    socketConnection.on('device_list', (deviceList) => {
      setDevices(deviceList);
    });

    setSocket(socketConnection);

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="nav-brand">
            <span className="logo">🔍 SPECTRATM</span>
            <span className="version">v2.0</span>
          </div>
          
          <div className="nav-links">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/heatmap">Heatmap</Link>
            <Link to="/logs">Logs</Link>
          </div>
          
          <div className="nav-status">
            <span className={`status ${isConnected ? 'online' : 'offline'}`}>
              {isConnected ? '🟢 Online' : '🔴 Offline'}
            </span>
            <span className="device-count">{devices.length} devices</span>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard socket={socket} devices={devices} />} />
            <Route path="/dashboard" element={<Dashboard socket={socket} devices={devices} />} />
            <Route path="/dash/:deviceId" element={<DeviceDetail socket={socket} />} />
            <Route path="/heatmap" element={<Heatmap devices={devices} />} />
            <Route path="/logs" element={<LogViewer socket={socket} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;