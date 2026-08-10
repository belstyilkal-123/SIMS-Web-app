/**
 * GISMap — Interactive satellite map card with soil-moisture pins
 * Uses Leaflet + OpenStreetMap (no API key required).
 * Falls back to a static placeholder if Leaflet fails.
 *
 * Props:
 *   farms   – array of farm objects { name, gps: {lat,lng} or location string }
 *   devices – array of device objects { name, status, farmId }
 *   isAmharic – boolean
 */
import React, { useEffect, useRef } from 'react';

// Dynamically import Leaflet to avoid SSR issues
let L = null;

const BAHIR_DAR = [11.5742, 37.3614]; // default center

const statusColor = (status) => status === 'online' ? '#15803d' : '#ef4444';

const GISMap = ({ farms = [], devices = [], isAmharic = false }) => {
  const mapRef    = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    // Load Leaflet CSS once
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id   = 'leaflet-css';
      link.rel  = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    import('leaflet').then(mod => {
      L = mod.default;

      if (!mapRef.current || instanceRef.current) return;

      // Build map
      const map = L.map(mapRef.current, {
        center: BAHIR_DAR,
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      instanceRef.current = map;

      // Satellite tile layer (free, no API key)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye',
          maxZoom: 19,
        }
      ).addTo(map);

      // Labels overlay
      L.tileLayer(
        'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.7 }
      ).addTo(map);

      // Place farm pins
      const bounds = [];
      farms.forEach((farm, i) => {
        // Try to use stored GPS, else use default cluster around Bahir Dar
        const lat = farm.gps?.lat  || BAHIR_DAR[0] + (i * 0.008);
        const lng = farm.gps?.lng  || BAHIR_DAR[1] + (i * 0.012);
        bounds.push([lat, lng]);

        // Find devices for this farm
        const farmDevices = devices.filter(d =>
          d.farmId?._id === farm._id || d.farmId === farm._id
        );
        const online = farmDevices.some(d => d.status === 'online');
        const color  = online ? '#15803d' : '#94a3b8';

        // Custom HTML marker
        const icon = L.divIcon({
          className: '',
          html: `
            <div style="
              background:${color};
              width:36px; height:36px;
              border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);
              border:3px solid white;
              box-shadow:0 2px 8px rgba(0,0,0,0.35);
              display:flex; align-items:center; justify-content:center;
            ">
              <span style="transform:rotate(45deg);font-size:16px;">🌾</span>
            </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -38],
        });

        const popup = `
          <div style="font-family:system-ui;min-width:160px">
            <strong style="font-size:0.9rem;color:#0f172a">${farm.name}</strong><br/>
            <span style="font-size:0.78rem;color:#64748b">📍 ${farm.location || 'Bahir Dar, ET'}</span><br/>
            <span style="font-size:0.78rem;color:#64748b">🌱 ${farm.cropType || 'N/A'}</span><br/>
            <hr style="margin:6px 0;border-color:#e2e8f0"/>
            ${farmDevices.map(d => `
              <div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;">
                <span style="width:8px;height:8px;border-radius:50%;background:${statusColor(d.status)};display:inline-block;flex-shrink:0"></span>
                ${d.name} — <strong style="color:${statusColor(d.status)}">${d.status?.toUpperCase()}</strong>
              </div>
            `).join('') || `<span style="font-size:0.78rem;color:#94a3b8">No devices</span>`}
          </div>`;

        L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(popup, { maxWidth: 220 });
      });

      // Fit map to all pins if we have any
      if (bounds.length > 0) {
        try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 }); }
        catch { /* ignore bounds error on single point */ }
      }
    }).catch(err => console.warn('Leaflet load failed:', err));

    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }
    };
  }, [farms, devices]);

  return (
    <div className="gis-card" style={{ gridColumn: '1 / -1' }}>
      <div className="gis-card-header">
        <h3>🌍 {isAmharic ? 'የህያው ሳተላይት ካርታ — የእርሻ ዞኖች' : 'Live Satellite Map — Farm Zones'}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#15803d', display: 'inline-block' }}/>
          {isAmharic ? 'ኦንላይን' : 'Online'}
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', display: 'inline-block', marginLeft: 6 }}/>
          {isAmharic ? 'ኦፍላይን' : 'Offline'}
          {farms.length > 0 && (
            <span style={{ marginLeft: 10, color: 'var(--text-muted)' }}>
              · {farms.length} {isAmharic ? 'ዞን' : `zone${farms.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
      </div>

      {farms.length === 0 ? (
        /* No farms registered yet — show instructional placeholder */
        <div style={{ height: 240, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
          background: '#f0f7f0', color: 'var(--text-muted)', textAlign: 'center', padding: '0 24px' }}>
          <span style={{ fontSize: '2.5rem' }}>🗺️</span>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
            {isAmharic ? 'ምንም የእርሻ ዞን አልተመዘገበም' : 'No Farm Zones Registered Yet'}
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem' }}>
            {isAmharic
              ? 'ካርታው ሲጨምሩ ዞኖቻቸዎን ያሳያል። በዞን ቁጥጥር ገጽ GPS መጌናናዊ ካርታ ያክሉ።'
              : 'Add farm zones with GPS coordinates in Zone Control to see them plotted here.'}
          </p>
        </div>
      ) : (
        <div className="gis-map-wrap" ref={mapRef} />
      )}
    </div>
  );
};

export default GISMap;
