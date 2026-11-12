import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ListingCard } from '../components/ui.jsx';
import { useAuth } from '../auth.jsx';

export default function Home() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);

  useEffect(() => {
    api('/listings').then((d) => setListings(d.listings.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <>
      <section className="hero">
        <h1>
          Turn crop residue into <span className="accent">income</span>, not smoke.
        </h1>
        <p>
          HarvestLoop connects farmers who have paddy straw, wheat straw and other crop residue with compost makers,
          biomass plants and animal-feed producers &mdash; and with transporters who move it.
        </p>
        <div className="row">
          {user ? (
            <Link to="/dashboard" className="btn gold">Go to my dashboard</Link>
          ) : (
            <Link to="/register" className="btn gold">Join HarvestLoop</Link>
          )}
          <Link to="/listings" className="btn secondary">Browse residue near you</Link>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>How it works</h2>
        <div className="grid cols-4">
          {[
            ['1', 'List', 'Farmers post residue type, quantity, photo, location and expected price.'],
            ['2', 'Discover & offer', 'Buyers search nearby, compare listings and send price offers. Farmers accept, reject or counter.'],
            ['3', 'Book pickup', 'An accepted offer becomes a booking with pickup date and a transporter.'],
            ['4', 'Track & earn', 'Follow the load from pickup to delivery; dashboards show quantity sold and estimated earnings.'],
          ].map(([n, t, d]) => (
            <div className="card" key={n}>
              <div className="step-num">{n}</div>
              <h3>{t}</h3>
              <p className="muted small">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Who it's for</h2>
        <div className="grid cols-3">
          <div className="card"><h3>Farmers</h3><p className="muted small">Find reliable buyers, set your price and track every sale instead of burning or discarding residue.</p></div>
          <div className="card"><h3>Buyers</h3><p className="muted small">Compost, biomass and feed businesses: find nearby suppliers, compare prices and book pickups in one place.</p></div>
          <div className="card"><h3>Transporters</h3><p className="muted small">See confirmed pickup jobs that fit your vehicle, accept them, and update status as you go.</p></div>
        </div>
      </section>

      {listings.length > 0 && (
        <section>
          <div className="row between">
            <h2>Fresh listings</h2>
            <Link to="/listings">See all →</Link>
          </div>
          <div className="grid cards">
            {listings.map((l) => <ListingCard key={l.id} l={l} />)}
          </div>
        </section>
      )}
    </>
  );
}
