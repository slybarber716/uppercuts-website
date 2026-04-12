let bookings = [];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST - client submits booking request
  if (req.method === 'POST') {
    const { name, phone, service, price, date, dateLabel, time, notes } = req.body;
    if (!name || !service || !date || !time) {
      return res.status(400).json({ error: 'Name, service, date, and time are required' });
    }

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
      created: new Date().toISOString()
    };
    bookings.unshift(booking);
    if (bookings.length > 200) bookings = bookings.slice(0, 200);

    return res.status(200).json({ success: true, booking });
  }

  // PUT - admin approves or denies
  if (req.method === 'PUT') {
    const { id, status } = req.body;
    const booking = bookings.find(b => b.id === id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    booking.status = status; // 'confirmed' or 'denied'
    return res.status(200).json({ success: true, booking });
  }

  // GET - return all bookings
  if (req.method === 'GET') {
    return res.status(200).json({ bookings });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
