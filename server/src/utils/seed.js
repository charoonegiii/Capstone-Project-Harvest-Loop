// Inserts demo data. All demo accounts use the password:  password123
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const PW = 'password123';

(async () => {
  const hash = await bcrypt.hash(PW, 10);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('TRUNCATE booking_events, bookings, offers, listings, transporters, users RESTART IDENTITY CASCADE');

    const addUser = async (name, email, role, extra = {}) =>
      (
        await c.query(
          `INSERT INTO users (name,email,password_hash,role,phone,organization,buyer_type,address,latitude,longitude)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [name, email, hash, role, extra.phone || null, extra.org || null, extra.btype || null,
           extra.address || null, extra.lat ?? null, extra.lng ?? null]
        )
      ).rows[0].id;

    // Admin
    await addUser('HarvestLoop Admin', 'admin@harvestloop.test', 'admin', { phone: '9000000000' });

    // Farmers
    const f1 = await addUser('Gurpreet Singh', 'farmer1@harvestloop.test', 'farmer',
      { phone: '9876500001', address: 'Village Jagraon, Ludhiana', lat: 30.7871, lng: 75.4742 });
    const f2 = await addUser('Harjinder Kaur', 'farmer2@harvestloop.test', 'farmer',
      { phone: '9876500002', address: 'Village Dhuri, Sangrur', lat: 30.3693, lng: 75.8627 });
    const f3 = await addUser('Balwinder Sandhu', 'farmer3@harvestloop.test', 'farmer',
      { phone: '9876500003', address: 'Village Rampura Phul, Bathinda', lat: 30.2640, lng: 75.2370 });

    // Buyers
    const b1 = await addUser('Green Earth Compost', 'buyer1@harvestloop.test', 'buyer',
      { phone: '9876500011', org: 'Green Earth Compost Pvt Ltd', btype: 'compost',
        address: 'Focal Point, Ludhiana', lat: 30.9010, lng: 75.8573 });
    const b2 = await addUser('Punjab Biomass Energy', 'buyer2@harvestloop.test', 'buyer',
      { phone: '9876500012', org: 'Punjab Biomass Energy Ltd', btype: 'biomass',
        address: 'Industrial Area, Patiala', lat: 30.3398, lng: 76.3869 });
    await addUser('Kisan Fodder Works', 'buyer3@harvestloop.test', 'buyer',
      { phone: '9876500013', org: 'Kisan Fodder Works', btype: 'animal_feed',
        address: 'Mandi Road, Moga', lat: 30.8160, lng: 75.1740 });

    // Transporters
    const tU1 = await addUser('Sukhdev Transport', 'transporter1@harvestloop.test', 'transporter',
      { phone: '9876500021', address: 'Ludhiana', lat: 30.9010, lng: 75.8573 });
    const tU2 = await addUser('Malwa Logistics', 'transporter2@harvestloop.test', 'transporter',
      { phone: '9876500022', address: 'Sangrur', lat: 30.2458, lng: 75.8421 });
    const t1 = (await c.query(
      `INSERT INTO transporters (user_id,vehicle_type,vehicle_number,capacity_kg,rate_per_km,base_location)
       VALUES ($1,'Tractor-trolley','PB10 AB 1234',6000,18,'Ludhiana') RETURNING id`, [tU1])).rows[0].id;
    await c.query(
      `INSERT INTO transporters (user_id,vehicle_type,vehicle_number,capacity_kg,rate_per_km,base_location)
       VALUES ($1,'Mini truck (Tata 407)','PB13 CD 5678',3500,22,'Sangrur')`, [tU2]);

    // Listings
    const addListing = async (farmer, title, type, qty, left, unit, price, loc, lat, lng, desc, status = 'active', photo = null) =>
      (await c.query(
        `INSERT INTO listings (farmer_id,title,residue_type,description,quantity,quantity_left,unit,price_per_unit,
           location_text,latitude,longitude,photo_url,status,available_from)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_DATE) RETURNING id`,
        [farmer, title, type, desc, qty, left, unit, price, loc, lat, lng, photo, status])).rows[0].id;

    const L1 = await addListing(f1, 'Baled paddy straw - post harvest', 'paddy_straw', 400, 400, 'quintal', 55,
      'Jagraon, Ludhiana', 30.7871, 75.4742, 'Square bales, stored under cover. Moisture is low. Loading by tractor-trolley possible.');
    const L2 = await addListing(f1, 'Loose wheat straw (bhusa)', 'wheat_straw', 250, 150, 'quintal', 320,
      'Jagraon, Ludhiana', 30.7871, 75.4742, 'Fresh bhusa, suitable for animal feed. 100 quintal already booked.');
    const L3 = await addListing(f2, 'Paddy straw - 12 acres', 'paddy_straw', 600, 600, 'quintal', 48,
      'Dhuri, Sangrur', 30.3693, 75.8627, 'Straw in field windrows, baling can be arranged by the buyer.');
    const L4 = await addListing(f2, 'Cotton stalks for biomass', 'cotton_stalk', 20, 20, 'tonne', 2400,
      'Dhuri, Sangrur', 30.3693, 75.8627, 'Dry stalks, chopped. Good for briquettes / biomass boilers.');
    const L5 = await addListing(f3, 'Rice husk from mill', 'rice_husk', 50, 50, 'tonne', 1800,
      'Rampura Phul, Bathinda', 30.2640, 75.2370, 'Clean husk, bagged on request.');
    await addListing(f3, 'Mustard stalks', 'mustard_stalk', 80, 80, 'quintal', 60,
      'Rampura Phul, Bathinda', 30.2640, 75.2370, 'Dry stalks, available from next week.');
    const L7 = await addListing(f1, 'Maize stalks', 'maize_stalk', 120, 120, 'quintal', 90,
      'Jagraon, Ludhiana', 30.7871, 75.4742, 'Dry maize stalks, chopped.');
    await addListing(f2, 'Sugarcane trash', 'sugarcane_residue', 300, 300, 'quintal', 70,
      'Sangrur', 30.2458, 75.8421, 'Sugarcane leaf and trash after harvest.');

    // Offers
    const addOffer = async (listing, buyer, qty, price, msg, status, cp = null, cq = null, cm = null) =>
      (await c.query(
        `INSERT INTO offers (listing_id,buyer_id,quantity,price_per_unit,message,status,counter_price,counter_quantity,counter_message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [listing, buyer, qty, price, msg, status, cp, cq, cm])).rows[0].id;

    // pending offer to farmer 1
    await addOffer(L1, b1, 200, 50, 'We need 200 quintal for composting. Can you do Rs 50?', 'pending');
    // countered offer (waiting for buyer)
    await addOffer(L3, b2, 300, 40, 'Can take 300 quintal next week.', 'countered', 45, 300, 'Best I can do is Rs 45 for 300 quintal.');
    // accepted offers -> bookings in various states
    const O1 = await addOffer(L2, b1, 100, 310, 'Need bhusa for our cattle-feed line.', 'accepted');
    const O2 = await addOffer(L4, b2, 10, 2300, 'Trial lot for our boiler.', 'accepted');
    const O3 = await addOffer(L7, b1, 40, 85, 'Pilot batch.', 'accepted');
    await addOffer(L5, b2, 20, 1500, 'Low ball offer', 'rejected');

    // adjust listing stock for the accepted bookings
    await c.query('UPDATE listings SET quantity_left = quantity_left - 10 WHERE id = $1', [L4]);
    await c.query('UPDATE listings SET quantity_left = quantity_left - 40 WHERE id = $1', [L7]);
    // (L2 was inserted with 150 left already reflecting 100 booked)

    const addBooking = async (offer, listing, farmer, buyer, tid, qty, price, status, pickupDays, pAddr, dAddr, fee) =>
      (await c.query(
        `INSERT INTO bookings (offer_id,listing_id,farmer_id,buyer_id,transporter_id,quantity,agreed_price,total_amount,
           pickup_date,pickup_address,delivery_address,delivery_fee,status,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CURRENT_DATE + $9::int, $10,$11,$12,$13, NOW() - interval '6 days', NOW() - interval '1 day')
         RETURNING id`,
        [offer, listing, farmer, buyer, tid, qty, price, qty * price, pickupDays, pAddr, dAddr, fee, status])).rows[0].id;

    const ev = (b, status, note, actor, daysAgo) =>
      c.query(
        `INSERT INTO booking_events (booking_id,status,note,actor_id,created_at)
         VALUES ($1,$2,$3,$4, NOW() - ($5 || ' days')::interval)`, [b, status, note, actor, String(daysAgo)]);

    // Delivered booking (earnings visible on dashboards)
    const B1 = await addBooking(O1, L2, f1, b1, t1, 100, 310, 'delivered', -3,
      'Jagraon, Ludhiana', 'Focal Point, Ludhiana', 780);
    await ev(B1, 'requested', 'Offer accepted: 100 quintal at Rs 310/quintal. Pickup requested.', f1, 6);
    await ev(B1, 'confirmed', 'Pickup confirmed.', f1, 5);
    await ev(B1, 'transporter_assigned', 'Sukhdev Transport (Tractor-trolley) assigned.', f1, 4);
    await ev(B1, 'picked_up', 'Material picked up from farm.', tU1, 3);
    await ev(B1, 'delivered', 'Material delivered to buyer.', tU1, 2);

    // Confirmed booking waiting for a transporter (shows in "open jobs")
    const B2 = await addBooking(O2, L4, f2, b2, null, 10, 2300, 'confirmed', 2,
      'Dhuri, Sangrur', 'Industrial Area, Patiala', null);
    await ev(B2, 'requested', 'Offer accepted: 10 tonne at Rs 2300/tonne. Pickup requested.', f2, 2);
    await ev(B2, 'confirmed', 'Pickup confirmed.', f2, 1);

    // Requested booking (farmer must confirm pickup date)
    const B3 = await addBooking(O3, L7, f1, b1, null, 40, 85, 'requested', 0,
      'Jagraon, Ludhiana', 'Focal Point, Ludhiana', null);
    await ev(B3, 'requested', 'Offer accepted: 40 quintal at Rs 85/quintal. Pickup requested.', f1, 0);
    await c.query('UPDATE bookings SET pickup_date = NULL WHERE id = $1', [B3]);

    await c.query('COMMIT');
    console.log('Seed complete. Demo logins (password: password123):');
    console.log('  admin@harvestloop.test | farmer1@harvestloop.test | buyer1@harvestloop.test | transporter1@harvestloop.test');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('Seed failed:', e);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
})();
