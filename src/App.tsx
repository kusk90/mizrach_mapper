import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MILE_METERS = 1609.344;
const JERUSALEM = { lat: 31.7780, lng: 35.2354 };

// Fix Leaflet marker icons (common bundler issue)
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

function initialBearingGC(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

function rhumbBearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  let Δλ = toRad(b.lng - a.lng);
  const Δψ = Math.log(Math.tan(φ2 / 2 + Math.PI / 4) / Math.tan(φ1 / 2 + Math.PI / 4));
  if (Math.abs(Δλ) > Math.PI) {
    Δλ = Δλ > 0 ? -(2 * Math.PI - Δλ) : 2 * Math.PI + Δλ;
  }
  const θ = Math.atan2(Δλ, Δψ);
  return (toDeg(θ) + 360) % 360;
}

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

function makeBearingLine(start: { lat: number; lng: number }, bearing: number, km: number) {
  const end = destinationGC(start, bearing, km * 1000);
  return [start, end] as { lat: number; lng: number }[];
}

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
  const [mode, setMode] = useState<'gc' | 'rhumb'>('gc');

  const bearing = useMemo(() => {
    if (!center) return null;
    return mode === 'gc' ? initialBearingGC(center, JERUSALEM) : rhumbBearing(center, JERUSALEM);
  }, [center, mode]);

  const line = useMemo(() => {
    if (!center || bearing == null) return null;
    return makeBearingLine(center, bearing, 50);
  }, [center, bearing]);

  async function geocode(query: string) {
    if (!query.trim()) return;
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '1');
    const res = await fetch(url.toString(), { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (data && data[0]) {
      const { lat, lon } = data[0];
      setCenter({ lat: parseFloat(lat), lng: parseFloat(lon) });
    } else {
      alert('Address not found. Try a fuller address (city, state).');
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => alert('Could not get your location: ' + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <div className="panel">
        <h1 style={{ margin: 0 }}>Mizrach Mapper</h1>
        <p className="note">Enter any address. The map shows a <b>1 mile</b> circle and a line pointing toward Jerusalem (Great‑circle or Rhumb).</p>
        <div className="row">
          <input
            className="input"
            placeholder="e.g., 1300 Utica Ave, Brooklyn, NY"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && geocode(address)}
          />
          <button className="btn" onClick={() => geocode(address)}>Search</button>
          <button className="btn alt" onClick={useMyLocation}>Use my location</button>
        </div>

        <div className="row" style={{ marginTop: '.5rem' }}>
          <label><input type="radio" name="mode" checked={mode==='gc'} onChange={() => setMode('gc')} /> Great‑circle</label>
          <label><input type="radio" name="mode" checked={mode==='rhumb'} onChange={() => setMode('rhumb')} /> Rhumb line</label>
          {center && bearing != null && (
            <span className="note">Bearing: {bearing.toFixed(1)}° (true)</span>
          )}
        </div>

        <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,.08)', marginTop: '.5rem' }}>
          <MapContainer
            center={center ?? { lat: 40.6782, lng: -73.9442 }}
            zoom={center ? 15 : 11}
            style={{ height: '70vh', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <FlyTo center={center} />
            {center && (
              <>
                <Marker position={[center.lat, center.lng]} />
                <Circle center={[center.lat, center.lng]} radius={MILE_METERS} />
                {line && <Polyline positions={line.map(p => [p.lat, p.lng]) as any} pathOptions={{ weight: 4 }} />}
              </>
            )}
          </MapContainer>
        </div>

        <p className="note" style={{ marginTop: '.5rem' }}>
          Notes: Great‑circle uses the initial geodesic bearing (shortest path). Rhumb keeps a constant compass heading.
          Bearings shown are relative to true north (no magnetic declination).
        </p>
      </div>
    </div>
  );
}
