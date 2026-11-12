import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ErrorBox } from '../components/ui.jsx';
import LocationPicker from '../components/LocationPicker.jsx';
import { BUYER_TYPES } from '../constants.js';

const ROLES = [
  ['farmer', 'Farmer', 'I have crop residue to sell'],
  ['buyer', 'Buyer', 'I want to buy residue'],
  ['transporter', 'Transporter', 'I move loads'],
];

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({
    role: 'farmer', name: '', email: '', password: '', phone: '', address: '',
    organization: '', buyer_type: 'compost', vehicle_type: '', vehicle_number: '', capacity_kg: '', rate_per_km: '',
    latitude: '', longitude: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(f);
      nav('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '1rem auto' }}>
      <div className="card">
        <h2>Create your account</h2>
        <ErrorBox error={error} />
        <form onSubmit={submit}>
          <div className="grid cols-3" style={{ marginBottom: '1rem' }}>
            {ROLES.map(([v, l, d]) => (
              <label
                key={v}
                className="card flat"
                style={{ cursor: 'pointer', borderColor: f.role === v ? 'var(--green)' : undefined, background: f.role === v ? 'var(--green-soft)' : undefined }}
              >
                <input type="radio" name="role" value={v} checked={f.role === v} onChange={set('role')} style={{ width: 'auto', marginRight: 6 }} />
                <strong>{l}</strong>
                <div className="small muted">{d}</div>
              </label>
            ))}
          </div>

          <div className="form-grid">
            <div className="field"><label htmlFor="name">Full name</label><input id="name" required value={f.name} onChange={set('name')} /></div>
            <div className="field"><label htmlFor="phone">Phone</label><input id="phone" value={f.phone} onChange={set('phone')} /></div>
            <div className="field"><label htmlFor="em">Email</label><input id="em" type="email" required value={f.email} onChange={set('email')} /></div>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input id="pw" type="password" required minLength={6} value={f.password} onChange={set('password')} autoComplete="new-password" />
              <div className="hint">At least 6 characters.</div>
            </div>
          </div>

          {f.role === 'buyer' && (
            <div className="form-grid">
              <div className="field"><label htmlFor="org">Organization</label><input id="org" value={f.organization} onChange={set('organization')} /></div>
              <div className="field">
                <label htmlFor="bt">Business type</label>
                <select id="bt" value={f.buyer_type} onChange={set('buyer_type')}>
                  {BUYER_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {f.role === 'transporter' && (
            <div className="form-grid">
              <div className="field"><label htmlFor="vt">Vehicle type</label><input id="vt" required placeholder="e.g. Tractor-trolley" value={f.vehicle_type} onChange={set('vehicle_type')} /></div>
              <div className="field"><label htmlFor="vn">Vehicle number</label><input id="vn" value={f.vehicle_number} onChange={set('vehicle_number')} /></div>
              <div className="field"><label htmlFor="cap">Capacity (kg)</label><input id="cap" type="number" min="1" required value={f.capacity_kg} onChange={set('capacity_kg')} /></div>
              <div className="field"><label htmlFor="rate">Rate per km (₹)</label><input id="rate" type="number" min="0" step="0.5" value={f.rate_per_km} onChange={set('rate_per_km')} /></div>
            </div>
          )}

          <div className="field">
            <label htmlFor="addr">{f.role === 'buyer' ? 'Delivery address (plant / yard)' : f.role === 'farmer' ? 'Village / farm address' : 'Base location'}</label>
            <input id="addr" value={f.address} onChange={set('address')} />
          </div>
          <div className="field">
            <label>Map location (optional, helps nearby search)</label>
            <LocationPicker
              latitude={f.latitude}
              longitude={f.longitude}
              onChange={(p) => setF((x) => ({ ...x, latitude: p.latitude, longitude: p.longitude, address: x.address || p.city || '' }))}
            />
          </div>

          <button className="btn block" disabled={busy}>{busy ? 'Creating account…' : 'Sign up'}</button>
        </form>
        <p className="small muted" style={{ marginTop: '1rem' }}>
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
