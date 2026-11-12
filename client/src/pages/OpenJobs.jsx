import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { ErrorBox } from '../components/ui.jsx';
import MapView from '../components/MapView.jsx';
import { fmtDate, inr, num, typeLabel } from '../constants.js';

export default function OpenJobs() {
  const toast = useToast();
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/bookings/open-jobs').then((d) => setJobs(d.jobs)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const accept = async (j) => {
    try {
      await api(`/bookings/${j.id}/accept-job`, { method: 'POST' });
      toast('Job accepted — it is now under My jobs');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const markers = (jobs || []).filter((j) => j.pickup_lat != null).map((j) => ({
    lat: j.pickup_lat, lng: j.pickup_lng, title: `#${j.id} ${j.listing_title}`, body: `${num(j.quantity)} ${j.unit} · pickup ${fmtDate(j.pickup_date)}`,
    link: `/bookings/${j.id}`,
  }));

  return (
    <>
      <div className="page-head">
        <div><h1>Open jobs</h1><p className="muted">Confirmed pickups waiting for a transporter.</p></div>
      </div>
      <ErrorBox error={error} />
      {!jobs ? (
        <div className="center-note">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="card empty">No open jobs right now. Check back soon.</div>
      ) : (
        <div className="split right">
          <div className="stack">
            {jobs.map((j) => (
              <div className="card" key={j.id}>
                <div className="row between">
                  <strong>#{j.id} · {j.listing_title}</strong>
                  <span className="badge blue">Pickup {fmtDate(j.pickup_date)}</span>
                </div>
                <div className="small muted">{typeLabel(j.residue_type)}</div>
                <dl className="kv" style={{ marginTop: '.5rem' }}>
                  <dt>Load</dt><dd>{num(j.quantity)} {j.unit} (~{num(j.quantity_kg, 0)} kg)</dd>
                  <dt>From</dt><dd>{j.pickup_address || j.location_text}</dd>
                  <dt>To</dt><dd>{j.delivery_address || '—'}</dd>
                  {j.distance_km != null && (<><dt>Distance</dt><dd>≈ {num(j.distance_km)} km</dd></>)}
                </dl>
                {j.fits_vehicle === false && <div className="alert warn small" style={{ marginTop: '.6rem' }}>This load exceeds your vehicle capacity.</div>}
                <div className="row" style={{ marginTop: '.6rem' }}>
                  <button className="btn sm" disabled={j.fits_vehicle === false} onClick={() => accept(j)}>Accept job</button>
                  <Link className="btn secondary sm" to={`/bookings/${j.id}`}>Details</Link>
                </div>
              </div>
            ))}
          </div>
          <MapView height="tall" markers={markers} />
        </div>
      )}
    </>
  );
}
