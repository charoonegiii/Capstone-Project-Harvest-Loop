import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, assetUrl } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { ErrorBox, StatusBadge } from '../components/ui.jsx';
import { inr, num, typeLabel, fmtDate } from '../constants.js';

export default function MyListings() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/listings/mine').then((d) => setRows(d.listings)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const remove = async (l) => {
    if (!window.confirm(`Remove "${l.title}"? Open offers on it will be rejected.`)) return;
    try {
      await api(`/listings/${l.id}`, { method: 'DELETE' });
      toast('Listing removed');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const setStatus = async (l, status) => {
    const fd = new FormData();
    fd.append('status', status);
    try {
      await api(`/listings/${l.id}`, { method: 'PUT', form: fd });
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>My listings</h1><p className="muted">Residue you have put up for sale.</p></div>
        <Link className="btn gold" to="/my-listings/new">+ New listing</Link>
      </div>
      <ErrorBox error={error} />
      {!rows ? (
        <div className="center-note">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card empty">You have no listings yet. <Link to="/my-listings/new">Create your first one.</Link></div>
      ) : (
        <div className="stack">
          {rows.map((l) => (
            <div className="card row between" key={l.id} style={{ alignItems: 'flex-start' }}>
              <div className="row" style={{ alignItems: 'flex-start', flex: 1, minWidth: 260 }}>
                <div style={{ width: 84, height: 70, borderRadius: 8, overflow: 'hidden', background: '#e8efdf', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {l.photo_url ? <img src={assetUrl(l.photo_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span aria-hidden>🌾</span>}
                </div>
                <div>
                  <Link to={`/listings/${l.id}`}><strong>{l.title}</strong></Link>
                  <div className="small muted">{typeLabel(l.residue_type)} · {l.location_text} · from {fmtDate(l.available_from)}</div>
                  <div className="small">
                    {num(l.quantity_left)} / {num(l.quantity)} {l.unit} left · {inr(l.price_per_unit)}/{l.unit}
                  </div>
                </div>
              </div>
              <div className="row">
                <StatusBadge status={l.status} />
                <Link className="btn secondary sm" to={`/my-listings/${l.id}/edit`}>Edit</Link>
                {l.status === 'active' && l.quantity_left === l.quantity && (
                  <button className="btn secondary sm" onClick={() => setStatus(l, 'sold')}>Mark sold</button>
                )}
                {l.status === 'sold' && l.quantity_left > 0 && (
                  <button className="btn secondary sm" onClick={() => setStatus(l, 'active')}>Reactivate</button>
                )}
                <button className="btn danger sm" onClick={() => remove(l)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
