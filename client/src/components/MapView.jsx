import { useEffect } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Vite does not resolve Leaflet's default icon paths, so set them explicitly
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

const PUNJAB = [30.9, 75.6];

function Fit({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], 10);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 11 });
  }, [map, JSON.stringify(points)]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickPicker({ onPick }) {
  useMapEvents({ click: (e) => onPick && onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/**
 * markers: [{ lat, lng, title, body, link }]
 * route:   [[lat,lng], ...] drawn as a dashed line
 * onPick:  (lat,lng) => void  makes the map clickable
 *
 * Uses OpenStreetMap tiles (no API key required).
 */
export default function MapView({ markers = [], route, onPick, height = '', zoom = 7 }) {
  const valid = markers.filter((m) => m.lat != null && m.lng != null);
  const pts = valid.map((m) => [m.lat, m.lng]);
  return (
    <MapContainer center={pts[0] || PUNJAB} zoom={zoom} scrollWheelZoom className={`map ${height}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Fit points={pts} />
      {onPick && <ClickPicker onPick={onPick} />}
      {valid.map((m, i) => (
        <Marker key={i} position={[m.lat, m.lng]}>
          {(m.title || m.body) && (
            <Popup>
              <strong>{m.title}</strong>
              {m.body && <div>{m.body}</div>}
              {m.link && <a href={m.link}>View details</a>}
            </Popup>
          )}
        </Marker>
      ))}
      {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#2f6b3a', dashArray: '6 8', weight: 3 }} />}
    </MapContainer>
  );
}
