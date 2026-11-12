import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import { BookingSteps, ErrorBox, StatusBadge, Timeline } from '../components/ui.jsx';
import MapView from '../components/MapView.jsx';
import { fmtDate, inr, num, typeLabel } from '../constants.js';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function BookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState({ pickup_date: todayStr(), pickup_address: '', delivery_address: '' });
  const [transporters, setTransporters] = useState([]);
  const [pickTransporter, setPickTransporter] = useState('');
  const [note, setNote] = useState('');

  const load = () =>
    api(`/bookings/${id}`)
      .then((d) => {
        setData(d);
        setConfirm((c) => ({ ...c, pickup_address: d.booking.pickup_address || '', delivery_address: d.booking.delivery_address || '' }));
      })
      .catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const b = data?.booking;
  const wantsTransporter = b && b.status === 'confirmed' && ['farmer', 'buyer'].includes(user.role);
  useEffect(() => {
    if (!wantsTransporter) return;
    const kg = b.quantity * ({ kg: 1, quintal: 100, tonne: 1000 }[b.unit] || 1);
    api(`/transporters?min_capacity_kg=${Math.ceil(kg)}`).then((d) => setTransporters(d.transporters)).catch(() => {});
  }, [wantsTransporter, b?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (path, body, msg) => {
    setBusy(true);
    try {
      await api(`/bookings/${id}/${path}`, { method: 'POST', body });
      toast(msg);
      setNote('');
      await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // transporter status updates optionally attach the device location
  const updateStatus = (status, msg) => {
    const send = (coords) => act('status', { status, note, ...(coords || {}) }, msg);
    if (!navigator.geolocation) return send();
    navigator.geolocation.getCurrentPosition(
      (p) => send({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => send(),
      { timeout: 4000 }
    );
  };

  if (error && !data) return <div className="card empty">{error}</div>;
  if (!data) return <div className="center-note">Loading…</div>;

  const isMyJob = user.role === 'transporter' && b.transporter_user_id === user.id;
  const canCancel = ['farmer', 'buyer', 'admin'].includes(user.role) && ['requested', 'confirmed', 'transporter_assigned'].includes(b.status);

  const markers = [];
  if (b.pickup_lat != null) markers.push({ lat: b.pickup_lat, lng: b.pickup_lng, title: 'Pickup', body: b.pickup_address || b.location_text });
  if (b.drop_lat != null) markers.push({ lat: b.drop_lat, lng: b.drop_lng, title: 'Delivery', body: b.delivery_address });
  data.events.filter((e) => e.latitude != null).forEach((e) => markers.push({ lat: e.latitude, lng: e.longitude, title: e.status.replace('_', ' '), body: e.note }));
  const route = b.pickup_lat != null && b.drop_lat != null ? [[b.pickup_lat, b.pickup_lng], [b.drop_lat, b.drop_lng]] : null;

  return (
    <>
      <p className="small"><Link to={user.role === 'transporter' && !isMyJob ? '/jobs' : '/bookings'}>← Back</Link></p>
      <div className="page-head">
        <div>
          <h1>Booking #{b.id}</h1>
          <p className="muted">{b.listing_title} · {typeLabel(b.residue_type)}</p>
        </div>
        <StatusBadge status={b.status} />
      </div>

      <div className="card"><BookingSteps status={b.status} /></div>

      <div className="split right" style={{ marginTop: '1rem' }}>
        <div className="stack">
          <div className="card">
            <h3>Order details</h3>
            <dl className="kv">
              <dt>Quantity</dt><dd>{num(b.quantity)} {b.unit}</dd>
              <dt>Agreed price</dt><dd>{inr(b.agreed_price)} / {b.unit}</dd>
              <dt>Total</dt><dd><strong>{inr(b.total_amount)}</strong> <span className="small muted">(material only)</span></dd>
              <dt>Pickup date</dt><dd>{fmtDate(b.pickup_date)}</dd>
              <dt>Pickup from</dt><dd>{b.pickup_address || b.location_text}</dd>
              <dt>Deliver to</dt><dd>{b.delivery_address || '—'}</dd>
              {b.distance_km != null && (<><dt>Distance</dt><dd>≈ {num(b.distance_km)} km (straight line)</dd></>)}
              {b.delivery_fee != null && (<><dt>Delivery fee</dt><dd>{inr(b.delivery_fee)} <span className="small muted">(estimate)</span></dd></>)}
            </dl>
          </div>

          <div className="card">
            <h3>Parties</h3>
            <div className="grid cols-3">
              <div><div className="small muted">Farmer</div><strong>{b.farmer_name}</strong><div className="small">{b.farmer_phone || ''}</div></div>
              <div><div className="small muted">Buyer</div><strong>{b.buyer_org || b.buyer_name}</strong><div className="small">{b.buyer_phone || ''}</div></div>
              <div>
                <div className="small muted">Transporter</div>
                {b.transporter_name ? (
                  <>
                    <strong>{b.transporter_name}</strong>
                    <div className="small">{b.vehicle_type} {b.vehicle_number && `· ${b.vehicle_number}`}</div>
                    <div className="small">{b.transporter_phone || ''}</div>
                  </>
                ) : <span className="muted">Not assigned</span>}
              </div>
            </div>
          </div>

          {markers.length > 0 && (
            <div className="card">
              <h3>Route</h3>
              <MapView height="small" markers={markers} route={route} />
            </div>
          )}
        </div>

        <aside className="stack">
          {/* Farmer: confirm pickup */}
          {user.role === 'farmer' && b.status === 'requested' && (
            <form className="card" onSubmit={(e) => { e.preventDefault(); act('confirm', confirm, 'Pickup confirmed'); }}>
              <h3>Confirm pickup</h3>
              <p className="muted small">Set when the material will be ready for collection.</p>
              <div className="field"><label htmlFor="pd">Pickup date</label><input id="pd" type="date" min={todayStr()} required value={confirm.pickup_date} onChange={(e) => setConfirm({ ...confirm, pickup_date: e.target.value })} /></div>
              <div className="field"><label htmlFor="pa">Pickup address</label><input id="pa" value={confirm.pickup_address} onChange={(e) => setConfirm({ ...confirm, pickup_address: e.target.value })} /></div>
              <div className="field"><label htmlFor="da">Delivery address</label><input id="da" value={confirm.delivery_address} onChange={(e) => setConfirm({ ...confirm, delivery_address: e.target.value })} /></div>
              <button className="btn block" disabled={busy}>Confirm pickup</button>
            </form>
          )}
          {user.role === 'buyer' && b.status === 'requested' && (
            <div className="alert info">Waiting for the farmer to confirm a pickup date.</div>
          )}

          {/* Farmer / buyer: pick a transporter */}
          {wantsTransporter && (
            <div className="card">
              <h3>Assign a transporter</h3>
              <p className="muted small">Transporters can also pick this job from the open-jobs board.</p>
              {transporters.length === 0 ? (
                <div className="small muted">No available transporter has enough capacity yet.</div>
              ) : (
                <>
                  <div className="field">
                    <select value={pickTransporter} onChange={(e) => setPickTransporter(e.target.value)} aria-label="Transporter">
                      <option value="">Choose…</option>
                      {transporters.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} — {t.vehicle_type}, {num(t.capacity_kg, 0)} kg{t.rate_per_km != null ? `, ₹${t.rate_per_km}/km` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="btn block" disabled={!pickTransporter || busy} onClick={() => act('assign', { transporter_id: pickTransporter }, 'Transporter assigned')}>Assign</button>
                </>
              )}
            </div>
          )}

          {/* Transporter: update status */}
          {isMyJob && ['transporter_assigned', 'picked_up'].includes(b.status) && (
            <div className="card">
              <h3>Update status</h3>
              <div className="field"><label htmlFor="n">Note (optional)</label><input id="n" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Loaded 40 bales" /></div>
              {b.status === 'transporter_assigned' && <button className="btn block" disabled={busy} onClick={() => updateStatus('picked_up', 'Marked as picked up')}>Mark picked up</button>}
              {b.status === 'picked_up' && <button className="btn block" disabled={busy} onClick={() => updateStatus('delivered', 'Marked as delivered')}>Mark delivered</button>}
              <p className="hint">Your device location is attached if you allow it.</p>
            </div>
          )}

          {user.role === 'transporter' && b.status === 'confirmed' && !b.transporter_id && (
            <div className="card">
              <h3>Open job</h3>
              <button className="btn block" disabled={busy} onClick={() => act('accept-job', {}, 'Job accepted')}>Accept this job</button>
            </div>
          )}

          {canCancel && (
            <button
              className="btn danger"
              disabled={busy}
              onClick={() => {
                const reason = window.prompt('Reason for cancelling (optional):');
                if (reason !== null) act('cancel', { reason }, 'Booking cancelled — material released back to the listing');
              }}
            >
              Cancel booking
            </button>
          )}

          <div className="card">
            <h3>Tracking</h3>
            <Timeline events={data.events} />
          </div>
        </aside>
      </div>
    </>
  );
}
