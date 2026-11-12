import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorBox, StatusBadge } from '../components/ui.jsx';
import { fmtDate, inr, num, typeLabel } from '../constants.js';

export default function Bookings() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    api('/bookings').then((d) => setRows(d.bookings)).catch((e) => setError(e.message));
  }, []);

  const shown = (rows || []).filter((b) =>
    filter === 'all' ? true : filter === 'active' ? !['delivered', 'cancelled'].includes(b.status) : ['delivered', 'cancelled'].includes(b.status)
  );
  const title = { farmer: 'Bookings', buyer: 'My orders', transporter: 'My jobs' }[user.role];

  return (
    <>
      <div className="page-head">
        <div><h1>{title}</h1><p className="muted">Pickup and delivery status for every sale.</p></div>
        <div className="tabs" style={{ margin: 0, border: 0 }}>
          {[['active', 'In progress'], ['done', 'Completed / cancelled'], ['all', 'All']].map(([v, l]) => (
            <button key={v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>
      </div>
      <ErrorBox error={error} />
      {!rows ? (
        <div className="center-note">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="card empty">
          No bookings here yet.{' '}
          {user.role === 'transporter' && <Link to="/jobs">Browse open jobs.</Link>}
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>#</th><th>Material</th><th>Quantity</th><th>Total</th>
                <th>{user.role === 'farmer' ? 'Buyer' : user.role === 'buyer' ? 'Farmer' : 'Route'}</th>
                <th>Pickup</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td><strong>{b.listing_title}</strong><div className="small muted">{typeLabel(b.residue_type)}</div></td>
                  <td>{num(b.quantity)} {b.unit}</td>
                  <td>{inr(b.total_amount)}<div className="small muted">@ {inr(b.agreed_price)}</div></td>
                  <td>
                    {user.role === 'farmer' && (b.buyer_org || b.buyer_name)}
                    {user.role === 'buyer' && b.farmer_name}
                    {user.role === 'transporter' && <span className="small">{b.location_text} → {b.delivery_address || '—'}</span>}
                  </td>
                  <td>{fmtDate(b.pickup_date)}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td><Link className="btn secondary sm" to={`/bookings/${b.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
