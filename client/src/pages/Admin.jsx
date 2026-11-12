import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { ErrorBox, StatusBadge } from '../components/ui.jsx';
import { fmtDate, inr, num, typeLabel } from '../constants.js';

export default function Admin() {
  const toast = useToast();
  const [tab, setTab] = useState('users');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setRows(null);
    api(`/admin/${tab}`).then((d) => setRows(d[tab])).catch((e) => setError(e.message));
  };
  useEffect(load, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (u) => {
    try {
      await api(`/admin/users/${u.id}/active`, { method: 'POST', body: { active: !u.is_active } });
      toast(u.is_active ? 'User deactivated' : 'User reactivated');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const removeListing = async (l) => {
    if (!window.confirm(`Remove listing "${l.title}"?`)) return;
    try {
      await api(`/listings/${l.id}`, { method: 'DELETE' });
      toast('Listing removed');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <>
      <div className="page-head"><div><h1>Administration</h1><p className="muted">Manage users, listings and bookings.</p></div></div>
      <div className="tabs">
        {['users', 'listings', 'bookings'].map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
        ))}
      </div>
      <ErrorBox error={error} />
      {!rows ? (
        <div className="center-note">Loading…</div>
      ) : (
        <div className="card table-wrap">
          {tab === 'users' && (
            <table className="t">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong>{u.organization && <div className="small muted">{u.organization}</div>}</td>
                    <td>{u.email}</td>
                    <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                    <td>{fmtDate(u.created_at)}</td>
                    <td><span className={`badge ${u.is_active ? 'green' : 'red'}`}>{u.is_active ? 'Active' : 'Deactivated'}</span></td>
                    <td>{u.role !== 'admin' && <button className={`btn sm ${u.is_active ? 'danger' : 'secondary'}`} onClick={() => toggle(u)}>{u.is_active ? 'Deactivate' : 'Reactivate'}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'listings' && (
            <table className="t">
              <thead><tr><th>Listing</th><th>Farmer</th><th>Qty left</th><th>Price</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td><Link to={`/listings/${l.id}`}><strong>{l.title}</strong></Link><div className="small muted">{typeLabel(l.residue_type)} · {l.location_text}</div></td>
                    <td>{l.farmer_name}</td>
                    <td>{num(l.quantity_left)} / {num(l.quantity)} {l.unit}</td>
                    <td>{inr(l.price_per_unit)}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td>{l.status !== 'removed' && <button className="btn danger sm" onClick={() => removeListing(l)}>Remove</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'bookings' && (
            <table className="t">
              <thead><tr><th>#</th><th>Material</th><th>Farmer → Buyer</th><th>Quantity</th><th>Total</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td>{b.id}</td>
                    <td>{b.listing_title}</td>
                    <td>{b.farmer_name} → {b.buyer_name}</td>
                    <td>{num(b.quantity)} {b.unit}</td>
                    <td>{inr(b.total_amount)}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td><Link className="btn secondary sm" to={`/bookings/${b.id}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
