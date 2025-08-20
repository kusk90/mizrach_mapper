import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MILE_METERS = 1609.344;
const JERUSALEM = { lat: 31.7780, lng: 35.2354 };

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Converts degrees to radians
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

// Great-circle bearing
function initialBearingGC(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Destination point along a bearing
function destinationGC(a: { lat: number; lng: number }, bearingDeg: number, distM: number) {
  const R = 6371000;
  const δ = distM / R;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(a.lat);
  const λ1 = toRad(a.lng);

  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1) * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  return { lat: toDeg(φ2), lng: ((toDeg(λ2) + 540) % 360) - 180 };
}

// Create a line along a bearing
function makeBearingLine(start: { lat: number; lng: number }, bearing: number, meters: number) {
  const end = destinationGC(start, bearing, meters);
  return [start, end] as { lat: number; lng: number }[];
}

// Fly-to helper
function FlyTo({ center }: { center: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo([center.lat, center.lng], 15, { duration: 0.8 });
  }, [center, map]);
  return null;
}

export default function App() {
  const [address, setAddress] = useState('');
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);

  const bearing = useMemo(() => {
    if (!center) return null;
    return initialBearingGC(center, JERUSALEM);
  }, [center]);

  const line = useMemo(() => {
    if (!center || bearing == null) return null;
    return makeBearingLine(center, bearing, 5000); // 5 km line
  }, [center, bearing]);

  async function geocode(query: string) {
    if (!query.trim()) return;
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data && data[0]) {
      setCenter({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
    } else {
      alert('Address not found');
    }
  }

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <div style={{ padding: 10 }}>
        <input
          placeholder="Enter address"
          value={address}
          onChange={e => setAddress(e.target.value)}
          style={{ width: 300, padding: 6 }}
        />
        <button onClick={() => geocode(address)} style={{ marginLeft: 6, padding: 6 }}>Go</button>
      </div>

      <MapContainer center={[40.6782, -73.9442]} zoom={13} style={{ height: '90%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {center && <Marker position={center} />}
        {center && <Circle center={center} radius={MILE_METERS} pathOptions={{ color: 'blue', fillOpacity: 0.1 }} />}
        {line && <Polyline positions={line} pathOptions={{ color: 'red' }} />}
        <FlyTo center={center} />
      </MapContainer>
    </div>
  );
}
