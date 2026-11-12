// End-to-end API smoke test. Requires a seeded database:  npm run db:reset && npm test
require('dotenv').config();
const app = require('../index');
const { pool } = require('../db');

let failures = 0;
const check = (name, cond, extra) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && extra ? '  -> ' + JSON.stringify(extra) : ''}`);
  if (!cond) failures++;
};

(async () => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, url, token, body) => {
    const r = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };
  const login = async (email) => (await call('POST', '/auth/login', null, { email, password: 'password123' })).data.token;

  try {
    check('health', (await call('GET', '/health')).data.ok === true);

    const farmer = await login('farmer1@harvestloop.test');
    const buyer = await login('buyer2@harvestloop.test');
    const transp = await login('transporter1@harvestloop.test');
    const admin = await login('admin@harvestloop.test');
    check('logins work', farmer && buyer && transp && admin);
    check('bad password rejected', (await call('POST', '/auth/login', null, { email: 'farmer1@harvestloop.test', password: 'x' })).status === 401);

    // registration
    const email = `new${Date.now()}@test.dev`;
    const reg = await call('POST', '/auth/register', null, { name: 'T', email, password: 'secret1', role: 'buyer', buyer_type: 'compost' });
    check('register buyer', reg.status === 201 && reg.data.user.role === 'buyer', reg.data);
    check('cannot self-register admin', (await call('POST', '/auth/register', null, { name: 'x', email: 'a' + email, password: 'secret1', role: 'admin' })).status === 400);

    // search
    const all = await call('GET', '/listings');
    check('list listings', all.data.listings.length >= 6);
    const near = await call('GET', '/listings?lat=30.9&lng=75.85&radius=60&type=wheat_straw');
    check('nearby + type filter', near.data.listings.length >= 1 && near.data.listings.every((l) => l.residue_type === 'wheat_straw' && l.distance_km <= 60), near.data);
    const q = await call('GET', '/listings?q=sangrur');
    check('text search', q.data.listings.length >= 1);

    // RBAC
    check('buyer cannot create listing', (await call('POST', '/listings', buyer, { title: 'x' })).status === 403);
    check('anonymous cannot offer', (await call('POST', '/offers', null, {})).status === 401);

    // listing CRUD
    const created = await call('POST', '/listings', farmer, {
      title: 'Test straw', residue_type: 'paddy_straw', quantity: 100, unit: 'quintal',
      price_per_unit: 50, location_text: 'Ludhiana', latitude: 30.9, longitude: 75.85,
    });
    check('create listing', created.status === 201, created.data);
    const lid = created.data.listing.id;
    check('invalid listing rejected', (await call('POST', '/listings', farmer, { title: 'x', residue_type: 'bad', quantity: 1, price_per_unit: 1, location_text: 'x' })).status === 400);

    // negotiation: offer -> counter -> buyer accepts -> booking
    const offer = await call('POST', '/offers', buyer, { listing_id: lid, quantity: 60, price_per_unit: 40, message: 'hi' });
    check('submit offer', offer.status === 201, offer.data);
    check('too-large offer rejected', (await call('POST', '/offers', buyer, { listing_id: lid, quantity: 1000, price_per_unit: 40 })).status === 400);
    check('duplicate open offer blocked', (await call('POST', '/offers', buyer, { listing_id: lid, quantity: 10, price_per_unit: 40 })).status === 409);
    const oid = offer.data.offer.id;
    const ctr = await call('POST', `/offers/${oid}/respond`, farmer, { action: 'counter', counter_price: 45, counter_quantity: 60 });
    check('farmer counters', ctr.data.offer && ctr.data.offer.status === 'countered', ctr.data);
    const acc = await call('POST', `/offers/${oid}/buyer-respond`, buyer, { action: 'accept' });
    check('buyer accepts counter -> booking', !!acc.data.booking_id, acc.data);
    const bid = acc.data.booking_id;

    const lAfter = (await call('GET', `/listings/${lid}`)).data.listing;
    check('stock reserved', lAfter.quantity_left === 40, lAfter);

    const bk = (await call('GET', `/bookings/${bid}`, buyer)).data.booking;
    check('booking total = qty x agreed price', bk.total_amount === 2700 && bk.status === 'requested', bk);

    // booking workflow
    check('transporter cannot see unconfirmed booking', (await call('GET', `/bookings/${bid}`, transp)).status === 403);
    check('confirm rejects past date', (await call('POST', `/bookings/${bid}/confirm`, farmer, { pickup_date: '2020-01-01' })).status === 400);
    const future = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    check('farmer confirms pickup', (await call('POST', `/bookings/${bid}/confirm`, farmer, { pickup_date: future })).data.booking.status === 'confirmed');
    const open = await call('GET', '/bookings/open-jobs', transp);
    check('open jobs visible to transporter', open.data.jobs.some((j) => j.id === bid), open.data);
    check('transporter accepts job', (await call('POST', `/bookings/${bid}/accept-job`, transp)).data.booking.status === 'transporter_assigned');
    check('cannot skip to delivered', (await call('POST', `/bookings/${bid}/status`, transp, { status: 'delivered' })).status === 409);
    check('picked up', (await call('POST', `/bookings/${bid}/status`, transp, { status: 'picked_up' })).data.booking.status === 'picked_up');
    check('delivered', (await call('POST', `/bookings/${bid}/status`, transp, { status: 'delivered', latitude: 30.3, longitude: 76.3 })).data.booking.status === 'delivered');
    const detail = (await call('GET', `/bookings/${bid}`, farmer)).data;
    check('timeline has 5 events', detail.events.length === 5, detail.events.length);
    check('cannot cancel delivered', (await call('POST', `/bookings/${bid}/cancel`, farmer)).status === 409);

    // cancellation releases stock
    const o2 = (await call('POST', '/offers', buyer, { listing_id: lid, quantity: 20, price_per_unit: 50 })).data.offer;
    const a2 = await call('POST', `/offers/${o2.id}/respond`, farmer, { action: 'accept' });
    check('direct accept', !!a2.data.booking_id, a2.data);
    check('stock after 2nd booking', (await call('GET', `/listings/${lid}`)).data.listing.quantity_left === 20);
    await call('POST', `/bookings/${a2.data.booking_id}/cancel`, buyer, { reason: 'changed plans' });
    check('cancel restores stock', (await call('GET', `/listings/${lid}`)).data.listing.quantity_left === 40);

    // dashboards
    const fd = (await call('GET', '/dashboard', farmer)).data;
    check('farmer dashboard earnings', fd.stats.earnings_completed >= 2700 + 31000, fd.stats);
    const bd = (await call('GET', '/dashboard', buyer)).data;
    check('buyer dashboard', bd.role === 'buyer' && bd.stats.total_spent >= 2700, bd.stats);
    const td = (await call('GET', '/dashboard', transp)).data;
    check('transporter dashboard', td.role === 'transporter' && td.stats.completed_jobs >= 1, td.stats);
    const ad = (await call('GET', '/dashboard', admin)).data;
    check('admin dashboard', ad.stats.farmers >= 3, ad.stats);

    // admin
    check('non-admin blocked from admin', (await call('GET', '/admin/users', farmer)).status === 403);
    check('admin lists users', (await call('GET', '/admin/users', admin)).data.users.length >= 9);

    // soft delete
    check('remove listing', (await call('DELETE', `/listings/${lid}`, farmer)).data.ok === true);
    check('removed listing hidden', (await call('GET', `/listings/${lid}`)).status === 404);
  } catch (e) {
    console.error('Test crashed:', e);
    failures++;
  } finally {
    server.close();
    await pool.end();
    console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
    process.exit(failures ? 1 : 0);
  }
})();
