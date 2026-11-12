import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, assetUrl } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import { ErrorBox, StatusBadge } from '../components/ui.jsx';
import MapView from '../components/MapView.jsx';
import { fmtDate, inr, num, typeLabel } from '../constants.js';

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [l, setL] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ quantity: '', price_per_unit: '', message: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/listings/${id}`)
      .then((d) => {
        setL(d.listing);
        setForm((f) => ({ ...f, quantity: Math.min(d.listing.quantity_left, d.listing.quantity), price_per_unit: d.listing.price_per_unit }));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error && !l) return <div className="card empty">{error}</div>;
  if (!l) return <div className="center-note">Loading…</div>;

  const isOwner = user && user.id === l.farmer_id;
  const total = (Number(form.quantity) || 0) * (Number(form.price_per_unit) || 0);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/offers', { method: 'POST', body: { listing_id: l.id, ...form } });
      toast('Offer sent to the farmer');
      nav('/offers');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="small"><Link to="/listings">← Back to listings</Link></p>
      <div className="split right">
        <div className="stack">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {l.photo_url ? (
              <img src={assetUrl(l.photo_url)} alt={l.title} style={{ width: '100%', maxHeight: 340, objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ height: 160, display: 'grid', placeItems: 'center', fontSize: '3rem', background: 'linear-gradient(135deg,#d9e6cf,#f3e6bf)' }} aria-hidden>🌾</div>
            )}
            <div style={{ padding: '1.1rem' }}>
              <div className="row between">
                <span className="badge green">{typeLabel(l.residue_type)}</span>
                <StatusBadge status={l.status} />
              </div>
              <h1 style={{ marginTop: '.5rem' }}>{l.title}</h1>
              <div className="price" style={{ fontSize: '1.5rem' }}>{inr(l.price_per_unit)} <small>/ {l.unit}</small></div>
              <p style={{ marginTop: '.75rem' }}>{l.description || 'No description provided.'}</p>
              <dl className="kv">
                <dt>Available</dt><dd>{num(l.quantity_left)} of {num(l.quantity)} {l.unit}</dd>
                <dt>Location</dt><dd>{l.location_text}</dd>
                <dt>Available from</dt><dd>{fmtDate(l.available_from)}</dd>
                <dt>Listed by</dt><dd>{l.farmer_name}</dd>
              </dl>
            </div>
          </div>

          {l.latitude != null && (
            <div className="card">
              <h3>Approximate location</h3>
              <MapView height="small" markers={[{ lat: l.latitude, lng: l.longitude, title: l.location_text }]} />
            </div>
          )}
        </div>

        <aside className="stack">
          {isOwner ? (
            <div className="card">
              <h3>Your listing</h3>
              <div className="row">
                <Link className="btn" to={`/my-listings/${l.id}/edit`}>Edit listing</Link>
                <Link className="btn secondary" to="/offers">View offers</Link>
              </div>
            </div>
          ) : !user ? (
            <div className="card">
              <h3>Interested?</h3>
              <p className="muted small">Log in as a buyer to make an offer on this listing.</p>
              <Link to="/login" state={{ from: `/listings/${l.id}` }} className="btn block">Log in</Link>
            </div>
          ) : user.role !== 'buyer' ? (
            <div className="card"><p className="muted small">Only buyer accounts can make offers.</p></div>
          ) : l.status !== 'active' ? (
            <div className="card"><p className="muted small">This listing is no longer accepting offers.</p></div>
          ) : (
            <form className="card" onSubmit={submit}>
              <h3>Make an offer</h3>
              <ErrorBox error={error} />
              <div className="field">
                <label htmlFor="oq">Quantity ({l.unit})</label>
                <input id="oq" type="number" step="any" min="0.01" max={l.quantity_left} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                <div className="hint">Up to {num(l.quantity_left)} {l.unit} available.</div>
              </div>
              <div className="field">
                <label htmlFor="op">Your price per {l.unit} (₹)</label>
                <input id="op" type="number" step="any" min="0" required value={form.price_per_unit} onChange={(e) => setForm({ ...form, price_per_unit: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="om">Message to farmer</label>
                <textarea id="om" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Intended use, pickup timing, questions…" />
              </div>
              <div className="alert info small">Offer total: <strong>{inr(total)}</strong> (excludes transport)</div>
              <button className="btn block" disabled={busy}>{busy ? 'Sending…' : 'Send offer'}</button>
              <p className="hint" style={{ marginTop: 8 }}>Verify material condition and quantity before the sale is finalized.</p>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
