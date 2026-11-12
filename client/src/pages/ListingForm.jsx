import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, assetUrl } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import { ErrorBox } from '../components/ui.jsx';
import LocationPicker from '../components/LocationPicker.jsx';
import { RESIDUE_TYPES, UNITS } from '../constants.js';

const today = () => new Date().toISOString().slice(0, 10);

export default function ListingForm() {
  const { id } = useParams();
  const editing = !!id;
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({
    title: '', residue_type: 'paddy_straw', description: '', quantity: '', unit: 'quintal', price_per_unit: '',
    location_text: user?.address || '', latitude: user?.latitude ?? '', longitude: user?.longitude ?? '', available_from: today(),
  });
  const [photo, setPhoto] = useState(null);
  const [existingPhoto, setExistingPhoto] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (!editing) return;
    api(`/listings/${id}`)
      .then(({ listing: l }) => {
        setF({
          title: l.title, residue_type: l.residue_type, description: l.description || '', quantity: l.quantity, unit: l.unit,
          price_per_unit: l.price_per_unit, location_text: l.location_text, latitude: l.latitude ?? '', longitude: l.longitude ?? '',
          available_from: (l.available_from || '').slice(0, 10),
        });
        setExistingPhoto(l.photo_url);
      })
      .catch((e) => setError(e.message));
  }, [id, editing]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => v !== '' && v !== null && fd.append(k, v));
      fd.set('description', f.description); // allow clearing the description when editing
      if (photo) fd.append('photo', photo);
      const res = await api(editing ? `/listings/${id}` : '/listings', { method: editing ? 'PUT' : 'POST', form: fd });
      toast(editing ? 'Listing updated' : 'Listing published');
      nav(`/listings/${res.listing.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1>{editing ? 'Edit listing' : 'New listing'}</h1>
      <form className="card" onSubmit={submit}>
        <ErrorBox error={error} />
        <div className="field">
          <label htmlFor="t">Title</label>
          <input id="t" required placeholder="e.g. Baled paddy straw, 12 acres" value={f.title} onChange={set('title')} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="rt">Residue type</label>
            <select id="rt" value={f.residue_type} onChange={set('residue_type')}>
              {RESIDUE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="av">Available from</label>
            <input id="av" type="date" value={f.available_from} onChange={set('available_from')} />
          </div>
          <div className="field">
            <label htmlFor="q">Quantity</label>
            <input id="q" type="number" step="any" min="0.01" required value={f.quantity} onChange={set('quantity')} />
          </div>
          <div className="field">
            <label htmlFor="u">Unit</label>
            <select id="u" value={f.unit} onChange={set('unit')}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="p">Expected price per {f.unit} (₹)</label>
            <input id="p" type="number" step="any" min="0" required value={f.price_per_unit} onChange={set('price_per_unit')} />
          </div>
          <div className="field">
            <label htmlFor="ph">Photo (JPG/PNG, up to 5 MB)</label>
            <input id="ph" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setPhoto(e.target.files[0] || null)} />
            {existingPhoto && !photo && <img src={assetUrl(existingPhoto)} alt="Current" style={{ height: 50, marginTop: 6, borderRadius: 6 }} />}
          </div>
        </div>
        <div className="field">
          <label htmlFor="d">Description</label>
          <textarea id="d" value={f.description} onChange={set('description')} placeholder="Condition, moisture, baled or loose, loading access…" />
        </div>
        <div className="field">
          <label htmlFor="loc">Approximate location (village / district)</label>
          <input id="loc" required value={f.location_text} onChange={set('location_text')} />
        </div>
        <div className="field">
          <label>Map pin</label>
          <LocationPicker
            latitude={f.latitude}
            longitude={f.longitude}
            onChange={(p) => setF((x) => ({ ...x, latitude: p.latitude, longitude: p.longitude, location_text: x.location_text || p.city || '' }))}
          />
        </div>
        <div className="row">
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Publish listing'}</button>
          <button type="button" className="btn secondary" onClick={() => nav(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
