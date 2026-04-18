const { Redis } = require('@upstash/redis');
const twilio = require('twilio');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

async function notifySly(booking) {
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const depositLine = booking.depositRequired
      ? (booking.depositPaid === 'pending' ? ` | 💰 Deposit $${booking.depositAmount} PENDING` : ` | ✅ Deposit $${booking.depositAmount} paid`)
      : ' | No deposit';
    await client.messages.create({
      body: `📅 NEW BOOKING\n${booking.name} (${booking.phone || 'no phone'})\n${booking.service} — ${booking.dateLabel || booking.date} @ ${booking.time}${depositLine}\nAdmin: uppercutsbysly.com/admin.html`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.SLY_PHONE
    });
  } catch (e) {
    console.error('Booking notify SMS failed:', e.message);
  }
}

const BOOKINGS_KEY = 'uppercuts:bookings';

// Service duration map (minutes) — keep in sync with the site
const SERVICE_DURATIONS = {
  'Kids Cut (13 & Under)': 45,
  'Teen Cut (14-17)': 45,
  'Premium Cut': 60,
  'Signature Cut': 75,
  'Signature + Shampoo': 90,
  'Beard / Line Up': 30,
  'Color': 60,
  'Facial': 30,
  'Eyebrows': 20
};
function getServiceDuration(name) {
  if (!name) return 60;
  let extra = 0;
  let base = name;
  if (base.endsWith(' + Facial')) { base = base.replace(' + Facial', ''); extra = 30; }
  return (SERVICE_DURATIONS[base] || 60) + extra;
}
function getServiceSlots(name) {
  return Math.max(1, Math.ceil(getServiceDuration(name) / 60));
}
// Convert "3:00 PM" -> 15 (hour of day, 0-23)
function timeToHour(t) {
  if (!t) return null;
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST - client submits booking request
  if (req.method === 'POST') {
    const { name, phone, service, price, date, dateLabel, notes, depositRequired, depositAmount, depositPaid } = req.body;
    let { time } = req.body;
    if (!name || !service || !date || !time) {
      return res.status(400).json({ error: 'Name, service, date, and time are required' });
    }
    // Enforce ON-THE-HOUR bookings only — reject anything that isn't :00
    const timeMatch = String(time).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!timeMatch) {
      return res.status(400).json({ error: 'Invalid time format' });
    }
    if (timeMatch[2] !== '00') {
      return res.status(400).json({ error: 'Only on-the-hour appointments are allowed.' });
    }
    // Normalize canonical format "H:00 AM/PM"
    time = parseInt(timeMatch[1], 10) + ':00 ' + timeMatch[3].toUpperCase();

    // Deposit info is tracked but NOT enforced server-side.
    // Bookings now submit immediately with depositPaid:'pending'.
    // Sly verifies payment manually in Square before confirming.

    const booking = {
      id: Date.now().toString(),
      name,
      phone: phone || '',
      service,
      price: price || '',
      date,
      dateLabel: dateLabel || date,
      time,
      notes: notes || '',
      status: 'pending',
      depositRequired: depositRequired || false,
      depositAmount: depositAmount || 0,
      depositPaid: depositPaid || false,
      created: new Date().toISOString()
    };

    let bookings = (await redis.get(BOOKINGS_KEY)) || [];

    // Prevent double bookings — check if this booking's hour range overlaps
    // any existing booking's hour range on the same date
    const newStart = timeToHour(time);
    const newSlots = getServiceSlots(service);
    if (newStart === null) {
      return res.status(400).json({ error: 'Invalid time format' });
    }
    const newEnd = newStart + newSlots; // exclusive
    const conflict = bookings.find(b => {
      if (b.date !== date || b.status === 'denied') return false;
      const bStart = timeToHour(b.time);
      if (bStart === null) return b.time === time;
      const bEnd = bStart + getServiceSlots(b.service);
      return newStart < bEnd && bStart < newEnd; // ranges overlap
    });
    if (conflict) {
      return res.status(409).json({ error: 'That time slot overlaps another booking. Please choose another time.' });
    }

    bookings.unshift(booking);
    if (bookings.length > 500) bookings = bookings.slice(0, 500);
    await redis.set(BOOKINGS_KEY, bookings);

    // Text Sly immediately when a new booking comes in
    notifySly(booking);

    return res.status(200).json({ success: true, booking });
  }

  // PUT - admin approves or denies
  if (req.method === 'PUT') {
    const { id, status } = req.body;
    let bookings = (await redis.get(BOOKINGS_KEY)) || [];
    const booking = bookings.find(b => b.id === id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    booking.status = status;
    await redis.set(BOOKINGS_KEY, bookings);
    return res.status(200).json({ success: true, booking });
  }

  // GET - return all bookings
  if (req.method === 'GET') {
    const bookings = (await redis.get(BOOKINGS_KEY)) || [];
    return res.status(200).json({ bookings });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
