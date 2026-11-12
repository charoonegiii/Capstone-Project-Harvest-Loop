import { useEffect, useState } from 'react';
import { api, qs } from '../api.js';
import { RESIDUE_TYPES, CITIES, typeLabel, inr, num } from '../constants.js';
import { ErrorBox, ListingCard } from '../components/ui.jsx';
import MapView from '../components/MapView.jsx';
import { useAuth } from '../auth.jsx';

const EMPTY = { q: '', type: '', minQty: '', maxPrice: '', availableBy: '', sort: '', radius: '50' };

export default function Browse() {
  const { user } = useAuth();
  const [f, setF] = useState(EMPTY);
  const [origin, setOrigin] = useState(
    user && user.latitude != null ? { lat: user.latitude, lng: user.longitude, label: 'your saved location' } : null
  );
  const [view, setView] = useState('list');
  const [data, setData] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const d = await api(
        '/listings' + qs({ ...f, radius: origin ? f.radius : '', lat: origin?.lat, lng: origin?.lng })
      );
      setData(d.listings);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // reload when the filters or origin change (debounced a little for typing)
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [f, origin]); // eslint-disable-line react-hooks/exhaustive-deps

  const locate = () => {
    if (!navigator.geolocation) return setError('Geolocation is not supported by this browser.');
    navigator.geolocation.getCurrentPosition(
      (p) => setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'your current location' }),
      () => setError('Could not get your location. Pick a city instead.')
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Find crop residue</h1>
          <p className="muted">Search by material, price and distance.</p>
        </div>
        <div className="tabs" style={{ margin: 0, border: 0 }}>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
          <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>Map</button>
        </div>
      </div>

      <div className="split">
        <aside className="card" aria-label="Filters">
          <div className="field">
            <label htmlFor="q">Search</label>
            <input id="q" placeholder="Title, village, district…" value={f.q} onChange={set('q')} />
          </div>
          <div className="field">
            <label htmlFor="type">Residue type</label>
            <select id="type" value={f.type} onChange={set('type')}>
              <option value="">All types</option>
              {RESIDUE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="mq">Minimum quantity available</label>
            <input id="mq" type="number" min="0" value={f.minQty} onChange={set('minQty')} />
            <div className="hint">In the listing's own unit.</div>
          </div>
          <div className="field">
            <label htmlFor="mp">Max price per unit (₹)</label>
            <input id="mp" type="number" min="0" value={f.maxPrice} onChange={set('maxPrice')} />
          </div>
          <div className="field">
            <label htmlFor="ab">Available by</label>
            <input id="ab" type="date" value={f.availableBy} onChange={set('availableBy')} />
          </div>

          <div className="field">
            <label>Near me</label>
            <select
              value=""
              onChange={(e) => {
                const c = CITIES.find((x) => x.name === e.target.value);
                if (c) setOrigin({ lat: c.lat, lng: c.lng, label: c.name });
              }}
              aria-label="Choose a city"
            >
              <option value="">Choose a city…</option>
              {CITIES.map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
            <button type="button" className="btn secondary sm block" style={{ marginTop: 6 }} onClick={locate}>
              📍 Use my location
            </button>
            {origin && (
              <>
                <div className="small" style={{ marginTop: 8 }}>
                  Within <strong>{f.radius} km</strong> of {origin.label}
                </div>
                <input type="range" min="10" max="300" step="10" value={f.radius} onChange={set('radius')} aria-label="Search radius in km" />
                <button type="button" className="btn secondary sm" onClick={() => setOrigin(null)}>Clear location</button>
              </>
            )}
          </div>

          <div className="field">
            <label htmlFor="sort">Sort by</label>
            <select id="sort" value={f.sort} onChange={set('sort')}>
              <option value="">{origin ? 'Nearest first' : 'Newest first'}</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="quantity">Largest quantity</option>
              {origin && <option value="distance">Nearest</option>}
            </select>
          </div>
          <button className="btn secondary block" onClick={() => { setF(EMPTY); setOrigin(null); }}>Reset filters</button>
        </aside>

        <section>
          <ErrorBox error={error} />
          {loading ? (
            <div className="center-note">Searching…</div>
          ) : data.length === 0 ? (
            <div className="card empty">No listings match these filters. Try widening the radius or clearing filters.</div>
          ) : view === 'list' ? (
            <>
              <p className="muted small">{data.length} listing{data.length === 1 ? '' : 's'} found</p>
              <div className="grid cards">{data.map((l) => <ListingCard key={l.id} l={l} />)}</div>
            </>
          ) : (
            <MapView
              height="tall"
              markers={[
                ...data.map((l) => ({
                  lat: l.latitude,
                  lng: l.longitude,
                  title: l.title,
                  body: `${typeLabel(l.residue_type)} · ${num(l.quantity_left)} ${l.unit} · ${inr(l.price_per_unit)}/${l.unit}`,
                  link: `/listings/${l.id}`,
                })),
              ]}
            />
          )}
        </section>
      </div>
    </>
  );
}
