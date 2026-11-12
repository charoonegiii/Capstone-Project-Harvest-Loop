import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { BarChart, ErrorBox, Stat, TypeBars } from '../components/ui.jsx';
import { inr, num } from '../constants.js';

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard').then(setD).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!d) return <div className="center-note">Loading dashboard…</div>;
  const s = d.stats;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hello, {user.name.split(' ')[0]}</h1>
          <p className="muted">Here is where things stand.</p>
        </div>
        {user.role === 'farmer' && <Link to="/my-listings/new" className="btn gold">+ New listing</Link>}
        {user.role === 'buyer' && <Link to="/listings" className="btn gold">Find residue</Link>}
        {user.role === 'transporter' && <Link to="/jobs" className="btn gold">See open jobs ({s.open_jobs})</Link>}
      </div>

      {d.role === 'farmer' && (
        <>
          <div className="grid cols-4">
            <Stat accent label="Estimated earnings" value={inr(s.earnings_completed)} sub="from delivered orders" />
            <Stat label="Quantity sold" value={`${num(s.quantity_sold_q)} q`} sub="quintals delivered" />
            <Stat label="Pending value" value={inr(s.earnings_pending)} sub="in open bookings" />
            <Stat label="Pending offers" value={s.pending_offers} sub={<Link to="/offers">review offers</Link>} />
          </div>
          <div className="grid cols-4" style={{ marginTop: '1rem' }}>
            <Stat label="Active listings" value={s.active_listings} />
            <Stat label="Total listed" value={`${num(s.total_listed_q)} q`} sub="quintals" />
            <Stat label="Active bookings" value={s.active_bookings} />
            <Stat label="Completed deliveries" value={s.completed_deliveries} sub={`${s.cancelled} cancelled`} />
          </div>
        </>
      )}

      {d.role === 'buyer' && (
        <div className="grid cols-4">
          <Stat accent label="Total spent" value={inr(s.total_spent)} sub="on delivered orders" />
          <Stat label="Procured" value={`${num(s.quantity_procured_q)} q`} sub="quintals delivered" />
          <Stat label="Committed" value={inr(s.committed)} sub="in open bookings" />
          <Stat label="Active bookings" value={s.active_bookings} sub={`${s.completed_orders} completed`} />
          <Stat label="Pending offers" value={s.pending_offers} />
          <Stat label="Counter-offers" value={s.counter_offers} sub={s.counter_offers > 0 ? <Link to="/offers">respond now</Link> : 'none waiting'} />
        </div>
      )}

      {d.role === 'transporter' && (
        <div className="grid cols-4">
          <Stat accent label="Delivery fees earned" value={inr(s.fees_earned)} sub="estimated, from completed jobs" />
          <Stat label="Fees pending" value={inr(s.fees_pending)} sub="on active jobs" />
          <Stat label="Active jobs" value={s.active_jobs} />
          <Stat label="Completed jobs" value={s.completed_jobs} sub={`${num(s.quantity_moved_q)} q moved`} />
        </div>
      )}

      {d.role === 'admin' && (
        <>
          <div className="grid cols-4">
            <Stat label="Farmers" value={s.farmers} />
            <Stat label="Buyers" value={s.buyers} />
            <Stat label="Transporters" value={s.transporters} />
            <Stat label="Active listings" value={s.active_listings} />
            <Stat label="Open offers" value={s.open_offers} />
            <Stat label="Active bookings" value={s.active_bookings} />
            <Stat label="Completed deliveries" value={s.completed_deliveries} />
            <Stat accent label="Trade value" value={inr(s.trade_value)} sub={`${num(s.quantity_traded_q)} q traded`} />
          </div>
        </>
      )}

      {d.role !== 'admin' && (
        <div className="grid cols-2" style={{ marginTop: '1.25rem' }}>
          <div className="card">
            <h3>{d.role === 'buyer' ? 'Monthly spend' : d.role === 'transporter' ? 'Monthly delivery fees' : 'Monthly earnings'}</h3>
            <BarChart data={d.monthly} />
          </div>
          {d.role === 'farmer' ? (
            <div className="card">
              <h3>Earnings by residue type</h3>
              <TypeBars data={d.byType} />
            </div>
          ) : (
            <div className="card">
              <h3>Monthly quantity (quintals)</h3>
              <BarChart data={d.monthly} valueKey="quantity_q" money={false} />
            </div>
          )}
        </div>
      )}

      {d.role === 'admin' && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <h3>Delivered value by residue type</h3>
          <TypeBars data={d.byType} />
        </div>
      )}

      <p className="hint" style={{ marginTop: '1rem' }}>
        Figures are estimates calculated from recorded quantities and agreed prices. Quantities are converted to
        quintals (1 quintal = 100 kg). Payments are not processed in this version.
      </p>
    </>
  );
}
