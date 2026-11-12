import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import { ErrorBox, StatusBadge } from '../components/ui.jsx';
import { fmtDateTime, inr, num, typeLabel } from '../constants.js';

function CounterForm({ offer, onDone, call }) {
  const [price, setPrice] = useState(offer.price_per_unit);
  const [qty, setQty] = useState(offer.quantity);
  const [msg, setMsg] = useState('');
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        call(offer, 'respond', { action: 'counter', counter_price: price, counter_quantity: qty, counter_message: msg }, 'Counter-offer sent').then((ok) => ok && onDone());
      }}
    >
      <div className="form-grid">
        <div className="field"><label>Counter price (₹/{offer.unit})</label><input type="number" step="any" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div className="field"><label>Quantity ({offer.unit})</label><input type="number" step="any" min="0.01" max={offer.quantity_left} required value={qty} onChange={(e) => setQty(e.target.value)} /></div>
      </div>
      <div className="field"><label>Note (optional)</label><input value={msg} onChange={(e) => setMsg(e.target.value)} /></div>
      <div className="row">
        <button className="btn sm">Send counter</button>
        <button type="button" className="btn secondary sm" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export default function Offers() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [offers, setOffers] = useState(null);
  const [error, setError] = useState('');
  const [countering, setCountering] = useState(null);
  const [filter, setFilter] = useState('open');
  const isFarmer = user.role === 'farmer';

  const load = () => api('/offers').then((d) => setOffers(d.offers)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  // POST an action on an offer; returns true on success
  const call = async (offer, path, body, okMsg) => {
    try {
      const res = await api(`/offers/${offer.id}/${path}`, { method: 'POST', body });
      toast(okMsg);
      await load();
      if (res.booking_id) nav(`/bookings/${res.booking_id}`);
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  };

  const shown = (offers || []).filter((o) =>
    filter === 'all' ? true : filter === 'open' ? ['pending', 'countered'].includes(o.status) : !['pending', 'countered'].includes(o.status)
  );
  const needsMe = (o) => (isFarmer ? o.status === 'pending' : o.status === 'countered');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{isFarmer ? 'Offers received' : 'My offers'}</h1>
          <p className="muted">{isFarmer ? 'Accept, reject or counter buyer offers.' : 'Track your offers and respond to counter-offers.'}</p>
        </div>
        <div className="tabs" style={{ margin: 0, border: 0 }}>
          {[['open', 'Open'], ['closed', 'Closed'], ['all', 'All']].map(([v, l]) => (
            <button key={v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>
      </div>
      <ErrorBox error={error} />
      {!offers ? (
        <div className="center-note">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="card empty">
          Nothing here. {!isFarmer && <Link to="/listings">Find residue to make an offer.</Link>}
        </div>
      ) : (
        <div className="stack">
          {shown.map((o) => (
            <div className="card" key={o.id} style={needsMe(o) ? { borderColor: 'var(--wheat)', boxShadow: '0 0 0 2px var(--wheat-soft)' } : undefined}>
              <div className="row between">
                <div>
                  <Link to={`/listings/${o.listing_id}`}><strong>{o.listing_title}</strong></Link>
                  <div className="small muted">{typeLabel(o.residue_type)} · {o.location_text} · {fmtDateTime(o.updated_at)}</div>
                </div>
                <StatusBadge status={o.status} />
              </div>

              <div className="grid cols-3" style={{ marginTop: '.75rem' }}>
                <div>
                  <div className="small muted">{isFarmer ? `Offer from ${o.buyer_org || o.buyer_name}` : 'Your offer'}</div>
                  <strong>{num(o.quantity)} {o.unit} @ {inr(o.price_per_unit)}</strong>
                  <div className="small muted">Total {inr(o.quantity * o.price_per_unit)}</div>
                </div>
                <div>
                  <div className="small muted">Asking price</div>
                  <strong>{inr(o.asking_price)}/{o.unit}</strong>
                  <div className="small muted">{num(o.quantity_left)} {o.unit} left</div>
                </div>
                {o.counter_price !== null && (
                  <div>
                    <div className="small muted">Counter-offer</div>
                    <strong>{num(o.counter_quantity)} {o.unit} @ {inr(o.counter_price)}</strong>
                    <div className="small muted">Total {inr(o.counter_quantity * o.counter_price)}</div>
                  </div>
                )}
              </div>
              {o.message && <p className="small" style={{ marginTop: '.6rem' }}>💬 “{o.message}”</p>}
              {o.counter_message && <p className="small">↩ “{o.counter_message}”</p>}

              <div className="row" style={{ marginTop: '.75rem' }}>
                {isFarmer && o.status === 'pending' && (
                  <>
                    <button className="btn sm" onClick={() => call(o, 'respond', { action: 'accept' }, 'Offer accepted — booking created')}>Accept</button>
                    <button className="btn secondary sm" onClick={() => setCountering(countering === o.id ? null : o.id)}>Counter</button>
                    <button className="btn danger sm" onClick={() => call(o, 'respond', { action: 'reject' }, 'Offer rejected')}>Reject</button>
                  </>
                )}
                {!isFarmer && o.status === 'countered' && (
                  <>
                    <button className="btn sm" onClick={() => call(o, 'buyer-respond', { action: 'accept' }, 'Counter accepted — booking created')}>Accept counter</button>
                    <button className="btn danger sm" onClick={() => call(o, 'buyer-respond', { action: 'reject' }, 'Counter declined')}>Decline</button>
                  </>
                )}
                {!isFarmer && ['pending', 'countered'].includes(o.status) && (
                  <button className="btn secondary sm" onClick={() => call(o, 'withdraw', {}, 'Offer withdrawn')}>Withdraw</button>
                )}
                {o.booking_id && <Link className="btn secondary sm" to={`/bookings/${o.booking_id}`}>View booking →</Link>}
              </div>
              {countering === o.id && <CounterForm offer={o} call={call} onDone={() => setCountering(null)} />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
