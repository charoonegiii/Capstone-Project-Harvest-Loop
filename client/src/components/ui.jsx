import { Link } from 'react-router-dom';
import { STATUS, BOOKING_FLOW, inr, num, typeLabel, fmtDateTime } from '../constants.js';
import { assetUrl } from '../api.js';

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: 'gray' };
  return <span className={`badge ${s.tone}`}>{s.label}</span>;
}

export function Stat({ label, value, sub, accent }) {
  return (
    <div className={`stat ${accent ? 'accent' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function ErrorBox({ error }) {
  return error ? <div className="alert error" role="alert">{error}</div> : null;
}

export function ListingCard({ l }) {
  return (
    <Link to={`/listings/${l.id}`} className="card lcard">
      <div className="photo">
        {l.photo_url ? <img src={assetUrl(l.photo_url)} alt={l.title} loading="lazy" /> : <span aria-hidden>🌾</span>}
      </div>
      <div className="body">
        <div className="row between">
          <span className="badge green">{typeLabel(l.residue_type)}</span>
          {l.distance_km !== undefined && l.distance_km !== null && (
            <span className="small muted">{num(l.distance_km)} km away</span>
          )}
        </div>
        <h3>{l.title}</h3>
        <div className="price">
          {inr(l.price_per_unit)} <small>/ {l.unit}</small>
        </div>
        <div className="small muted">
          {num(l.quantity_left)} {l.unit} available · {l.location_text}
        </div>
        <div className="small muted">by {l.farmer_name}</div>
      </div>
    </Link>
  );
}

// Horizontal progress through the booking flow
export function BookingSteps({ status }) {
  if (status === 'cancelled') return <div className="alert error">This booking was cancelled.</div>;
  const idx = BOOKING_FLOW.indexOf(status);
  const labels = { requested: 'Requested', confirmed: 'Confirmed', transporter_assigned: 'Transporter', picked_up: 'Picked up', delivered: 'Delivered' };
  return (
    <div className="steps">
      {BOOKING_FLOW.map((s, i) => (
        <div key={s} className={`step ${i <= idx ? 'done' : ''} ${i === idx ? 'current' : ''}`}>
          {labels[s]}
        </div>
      ))}
    </div>
  );
}

export function Timeline({ events }) {
  return (
    <ul className="timeline">
      {events.map((e) => (
        <li key={e.id}>
          <div className="row between">
            <StatusBadge status={e.status} />
            <span className="small muted">{fmtDateTime(e.created_at)}</span>
          </div>
          {e.note && <div className="small" style={{ marginTop: 4 }}>{e.note}</div>}
          {e.actor_name && <div className="small muted">by {e.actor_name}</div>}
        </li>
      ))}
    </ul>
  );
}

// Monthly bar chart (pure CSS)
export function BarChart({ data, valueKey = 'earnings', money = true }) {
  if (!data || !data.length) return <div className="empty">No completed deliveries yet.</div>;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  const monthLabel = (m) => new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  return (
    <div className="bars" role="img" aria-label="Monthly totals">
      {data.map((d) => {
        const v = Number(d[valueKey]) || 0;
        return (
          <div className="col" key={d.month}>
            <div className="bar-val">{money ? inr(v) : num(v)}</div>
            <div className="bar" style={{ height: `${Math.max((v / max) * 100, 2)}%` }} />
            <div className="bar-lab">{monthLabel(d.month)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function TypeBars({ data }) {
  if (!data || !data.length) return <div className="empty">Nothing to show yet.</div>;
  const max = Math.max(...data.map((d) => Number(d.earnings) || 0), 1);
  return (
    <div>
      {data.map((d) => (
        <div className="hbar" key={d.residue_type}>
          <div className="name">{typeLabel(d.residue_type)}</div>
          <div className="track"><div className="fill" style={{ width: `${(d.earnings / max) * 100}%` }} /></div>
          <div className="val">{inr(d.earnings)}</div>
        </div>
      ))}
    </div>
  );
}
