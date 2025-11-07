import React, { useState, useEffect } from 'react';

const LogViewer = ({ socket }) => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  useEffect(() => {
    if (socket) {
      socket.on('log_entry', (logData) => {
        setLogs(prev => {
          const newLogs = [...prev, {
            ...logData,
            timestamp: new Date(),
            id: Date.now() + Math.random()
          }];
          // Keep only last 1000 logs to prevent memory issues
          return newLogs.slice(-1000);
        });
      });

      socket.on('historical_logs', (logArray) => {
        setLogs(logArray.map(log => ({
          ...log,
          timestamp: new Date(log.timestamp),
          id: log.id || Date.now() + Math.random()
        })));
      });

      // Request historical logs on mount
      socket.emit('request_logs');
    }
  }, [socket]);

  useEffect(() => {
    if (isAutoScroll) {
      const logContainer = document.querySelector('.log-entries');
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }
  }, [logs, isAutoScroll]);

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.level === filter;
    const matchesSearch = search === '' || 
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      (log.deviceId && log.deviceId.toLowerCase().includes(search.toLowerCase()));
    
    return matchesFilter && matchesSearch;
  });

  const clearLogs = () => {
    setLogs([]);
    if (socket) {
      socket.emit('clear_logs');
    }
  };

  const exportLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${log.timestamp.toISOString()}] ${log.level.toUpperCase()} - ${log.deviceId || 'SYSTEM'}: ${log.message}`
    ).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spectratm-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLogIcon = (level) => {
    switch (level) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'success': return '✅';
      default: return '📝';
    }
  };

  const getLogCount = (level) => {
    return logs.filter(log => log.level === level).length;
  };

  return (
    <div className="log-viewer fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#00ff88' }}>📋 System Logs</h2>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #333344',
              background: '#1a1a2e',
              color: '#ffffff',
              width: '200px'
            }}
          />
          
          <button
            onClick={() => setIsAutoScroll(!isAutoScroll)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              border: '1px solid #333344',
              background: isAutoScroll ? '#00ff88' : '#1a1a2e',
              color: isAutoScroll ? '#000000' : '#ffffff',
              cursor: 'pointer'
            }}
          >
            Auto Scroll {isAutoScroll ? '🔛' : '🔲'}
          </button>
          
          <button
            onClick={exportLogs}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              border: '1px solid #333344',
              background: '#1a1a2e',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            📥 Export
          </button>
          
          <button
            onClick={clearLogs}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              border: '1px solid #ff4444',
              background: 'rgba(255, 68, 68, 0.2)',
              color: '#ff4444',
              cursor: 'pointer'
            }}
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'filter-active' : ''}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: '1px solid #333344',
            background: filter === 'all' ? '#00ff88' : '#1a1a2e',
            color: filter === 'all' ? '#000000' : '#ffffff',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          All ({logs.length})
        </button>
        
        <button
          onClick={() => setFilter('info')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: '1px solid #333344',
            background: filter === 'info' ? '#00ff88' : '#1a1a2e',
            color: filter === 'info' ? '#000000' : '#ffffff',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Info ({getLogCount('info')})
        </button>
        
        <button
          onClick={() => setFilter('warning')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: '1px solid #333344',
            background: filter === 'warning' ? '#00ff88' : '#1a1a2e',
            color: filter === 'warning' ? '#000000' : '#ffffff',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Warning ({getLogCount('warning')})
        </button>
        
        <button
          onClick={() => setFilter('error')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: '1px solid #333344',
            background: filter === 'error' ? '#00ff88' : '#1a1a2e',
            color: filter === 'error' ? '#000000' : '#ffffff',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Error ({getLogCount('error')})
        </button>
      </div>

      <div 
        className="log-entries"
        style={{ 
          height: '500px', 
          overflowY: 'auto',
          background: '#0f0f1a',
          border: '1px solid #333344',
          borderRadius: '8px',
          padding: '1rem'
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '2rem', 
            color: '#a0a0a0' 
          }}>
            {logs.length === 0 ? 'No logs available' : 'No logs match current filter'}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className={`log-entry ${log.level}`}>
              <span style={{ marginRight: '0.5rem' }}>{getLogIcon(log.level)}</span>
              <span style={{ color: '#a0a0a0', marginRight: '1rem', fontSize: '0.8rem' }}>
                {log.timestamp.toLocaleTimeString()}
              </span>
              {log.deviceId && (
                <span style={{ 
                  color: '#00ff88', 
                  marginRight: '1rem', 
                  fontSize: '0.8rem',
                  background: 'rgba(0, 255, 136, 0.1)',
                  padding: '0.1rem 0.5rem',
                  borderRadius: '12px'
                }}>
                  {log.deviceId}
                </span>
              )}
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>

      <div style={{ 
        marginTop: '1rem', 
        padding: '0.5rem', 
        background: '#1a1a2e', 
        borderRadius: '4px',
        fontSize: '0.9rem',
        color: '#a0a0a0',
        textAlign: 'center'
      }}>
        Showing {filteredLogs.length} of {logs.length} total log entries
        {search && ` | Filtered by: "${search}"`}
      </div>
    </div>
  );
};

export default LogViewer;