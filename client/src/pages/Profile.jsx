import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import { ErrorBox } from '../components/ui.jsx';
import LocationPicker from '../components/LocationPicker.jsx';
import { BUYER_TYPES } from '../constants.js';

export default function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({
    name: user.name, phone: user.phone || '', organization: user.organization || '', buyer_type: user.buyer_type || 'compost',
    address: user.address || '', latitude: user.latitude ?? '', longitude: user.longitude ?? '',
  });
  const [v, setV] = useState(user.transporter || null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setVeh = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  useEffect(() => {
    if (user.role === 'transporter') api('/transporters/me').then((d) => setV(d.transporter)).catch(() => {});
  }, [user.role]);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/auth/me', { method: 'PUT', body: f });
      if (user.role === 'transporter' && v) {
        await api('/transporters/me', {
          method: 'PUT',
          body: { vehicle_type: v.vehicle_type, vehicle_number: v.vehicle_number, capacity_kg: v.capacity_kg, rate_per_km: v.rate_per_km, base_location: v.base_location, is_available: !!v.is_available },
        });
      }
      await refresh();
      toast('Profile saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <h1>{user.role === 'transporter' ? 'Profile & vehicle' : 'My profile'}</h1>
      <form className="card" onSubmit={save}>
        <ErrorBox error={error} />
        <p className="small muted">{user.email} · <span style={{ textTransform: 'capitalize' }}>{user.role}</span></p>
        <div className="form-grid">
          <div className="field"><label htmlFor="n">Name</label><input id="n" required value={f.name} onChange={set('name')} /></div>
          <div className="field"><label htmlFor="p">Phone</label><input id="p" value={f.phone} onChange={set('phone')} /></div>
        </div>
        {user.role === 'buyer' && (
          <div className="form-grid">
            <div className="field"><label htmlFor="o">Organization</label><input id="o" value={f.organization} onChange={set('organization')} /></div>
            <div className="field">
              <label htmlFor="bt">Business type</label>
              <select id="bt" value={f.buyer_type} onChange={set('buyer_type')}>
                {BUYER_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="field"><label htmlFor="a">{user.role === 'buyer' ? 'Delivery address' : 'Address'}</label><input id="a" value={f.address} onChange={set('address')} /></div>
        <div className="field">
          <label>Map location</label>
          <LocationPicker latitude={f.latitude} longitude={f.longitude} onChange={(p) => setF((x) => ({ ...x, latitude: p.latitude, longitude: p.longitude }))} />
        </div>

        {user.role === 'transporter' && v && (
          <>
            <h3 style={{ marginTop: '1rem' }}>Vehicle</h3>
            <div className="form-grid">
              <div className="field"><label htmlFor="vt">Vehicle type</label><input id="vt" required value={v.vehicle_type || ''} onChange={setVeh('vehicle_type')} /></div>
              <div className="field"><label htmlFor="vn">Vehicle number</label><input id="vn" value={v.vehicle_number || ''} onChange={setVeh('vehicle_number')} /></div>
              <div className="field"><label htmlFor="cap">Capacity (kg)</label><input id="cap" type="number" min="1" required value={v.capacity_kg || ''} onChange={setVeh('capacity_kg')} /></div>
              <div className="field"><label htmlFor="r">Rate per km (₹)</label><input id="r" type="number" step="0.5" min="0" value={v.rate_per_km ?? ''} onChange={setVeh('rate_per_km')} /></div>
            </div>
            <label className="row" style={{ cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={!!v.is_available} onChange={setVeh('is_available')} />
              Available for new jobs
            </label>
          </>
        )}
        <div style={{ marginTop: '1rem' }}><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </div>
  );
}
