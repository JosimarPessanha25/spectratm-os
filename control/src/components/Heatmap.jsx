import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

// Mapbox access token - replace with your actual token
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjazZ2a2o3bWcwMDAwM25wZnVjNWl0ZTg1In0.example';

const Heatmap = ({ devices }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-70.9);
  const [lat, setLat] = useState(42.35);
  const [zoom, setZoom] = useState(9);

  useEffect(() => {
    if (map.current) return; // Initialize map only once
    
    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v10',
      center: [lng, lat],
      zoom: zoom
    });

    map.current.on('move', () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setZoom(map.current.getZoom().toFixed(2));
    });
  }, []);

  useEffect(() => {
    if (!map.current || !devices.length) return;

    // Clear existing markers
    const existingMarkers = document.querySelectorAll('.device-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add device markers
    devices.forEach((device, index) => {
      if (device.coordinates) {
        const [longitude, latitude] = device.coordinates;
        
        // Create custom marker element
        const el = document.createElement('div');
        el.className = 'device-marker';
        el.style.backgroundImage = device.status === 'active' 
          ? 'radial-gradient(circle, #00ff88 0%, #00cc6a 70%, transparent 100%)'
          : 'radial-gradient(circle, #ff4444 0%, #cc3333 70%, transparent 100%)';
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.borderRadius = '50%';
        el.style.border = '2px solid #ffffff';
        el.style.cursor = 'pointer';

        // Create popup
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="color: black; padding: 8px;">
            <h4>${device.name || `Device ${device.id}`}</h4>
            <p><strong>Status:</strong> ${device.status}</p>
            <p><strong>Battery:</strong> ${device.battery}%</p>
            <p><strong>Last Seen:</strong> ${new Date(device.lastSeen).toLocaleString()}</p>
          </div>
        `);

        // Add marker to map
        new mapboxgl.Marker(el)
          .setLngLat([longitude, latitude])
          .setPopup(popup)
          .addTo(map.current);
      }
    });

    // Fit map to show all devices
    if (devices.length > 0) {
      const coordinates = devices
        .filter(device => device.coordinates)
        .map(device => device.coordinates);
      
      if (coordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach(coord => bounds.extend(coord));
        map.current.fitBounds(bounds, { padding: 50 });
      }
    }
  }, [devices]);

  // Generate heatmap data if we have enough devices
  useEffect(() => {
    if (!map.current || devices.length < 3) return;

    const heatmapData = {
      type: 'FeatureCollection',
      features: devices
        .filter(device => device.coordinates)
        .map(device => ({
          type: 'Feature',
          properties: {
            intensity: device.status === 'active' ? 1 : 0.3
          },
          geometry: {
            type: 'Point',
            coordinates: device.coordinates
          }
        }))
    };

    // Add heatmap layer
    if (map.current.getSource('device-heatmap')) {
      map.current.getSource('device-heatmap').setData(heatmapData);
    } else {
      map.current.addSource('device-heatmap', {
        type: 'geojson',
        data: heatmapData
      });

      map.current.addLayer({
        id: 'device-heatmap-layer',
        type: 'heatmap',
        source: 'device-heatmap',
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'intensity'],
            0, 0,
            1, 1
          ],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 1,
            15, 3
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0, 0, 255, 0)',
            0.1, 'rgba(0, 255, 136, 0.1)',
            0.3, 'rgba(0, 255, 136, 0.3)',
            0.5, 'rgba(255, 170, 0, 0.5)',
            0.7, 'rgba(255, 68, 68, 0.7)',
            1, 'rgba(255, 0, 0, 1)'
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 2,
            15, 20
          ]
        }
      }, 'waterway-label');
    }
  }, [devices]);

  return (
    <div className="heatmap-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ color: '#00ff88' }}>🗺️ Device Location Heatmap</h2>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: '#a0a0a0' }}>
          <span>Longitude: {lng}</span>
          <span>Latitude: {lat}</span>
          <span>Zoom: {zoom}</span>
        </div>
      </div>
      
      <div 
        ref={mapContainer} 
        style={{ 
          width: '100%', 
          height: '500px', 
          borderRadius: '8px',
          border: '1px solid #333344'
        }} 
      />
      
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              background: '#00ff88',
              border: '1px solid white'
            }}></div>
            <span style={{ fontSize: '0.9rem', color: '#a0a0a0' }}>Active Device</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              background: '#ff4444',
              border: '1px solid white'
            }}></div>
            <span style={{ fontSize: '0.9rem', color: '#a0a0a0' }}>Inactive Device</span>
          </div>
        </div>
        
        <div style={{ fontSize: '0.9rem', color: '#a0a0a0' }}>
          {devices.filter(d => d.coordinates).length} of {devices.length} devices have location data
        </div>
      </div>
    </div>
  );
};

export default Heatmap;