import { useState } from 'react';
import { CITIES } from '../constants.js';
import MapView from './MapView.jsx';

/**
 * Lets a user set { latitude, longitude } three ways:
 * pick a nearby city, use browser geolocation, or click the map.
 * Calls onChange({ latitude, longitude, city? }).
 */
export default function LocationPicker({ latitude, longitude, onChange, showMap = true }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const has = latitude !== '' && latitude != null && longitude !== '' && longitude != null;

  const useMine = () => {
    setErr('');
    if (!navigator.geolocation) return setErr('Geolocation is not supported by this browser.');
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(false);
        onChange({ latitude: +p.coords.latitude.toFixed(5), longitude: +p.coords.longitude.toFixed(5) });
      },
      () => {
        setBusy(false);
        setErr('Could not get your location. Pick a city or click the map instead.');
      },
      { timeout: 10000 }
    );
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: '.5rem' }}>
        <select
          style={{ width: 'auto', flex: 1, minWidth: 160 }}
          value=""
          onChange={(e) => {
            const c = CITIES.find((x) => x.name === e.target.value);
            if (c) onChange({ latitude: c.lat, longitude: c.lng, city: c.name });
          }}
          aria-label="Pick a nearby city"
        >
          <option value="">Pick nearest city…</option>
          {CITIES.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
        <button type="button" className="btn secondary sm" onClick={useMine} disabled={busy}>
          {busy ? 'Locating…' : '📍 Use my location'}
        </button>
      </div>
      {err && <div className="hint" style={{ color: 'var(--red)' }}>{err}</div>}
      {showMap && (
        <MapView
          height="small"
          markers={has ? [{ lat: Number(latitude), lng: Number(longitude), title: 'Selected location' }] : []}
          onPick={(lat, lng) => onChange({ latitude: +lat.toFixed(5), longitude: +lng.toFixed(5) })}
        />
      )}
      <div className="hint">
        {has ? `Selected: ${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}` : 'Click the map to drop a pin.'}
        {' '}Only an approximate location is shown to other users.
      </div>
    </div>
  );
}
