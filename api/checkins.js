const twilio = require('twilio');

let checkins = [];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST - client checks in
  if (req.method === 'POST') {
    const { name, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const checkin = {
      name,
      phone: phone || '',
      time: new Date().toISOString(),
      timeDisplay: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })
    };
    checkins.unshift(checkin);
    if (checkins.length > 50) checkins = checkins.slice(0, 50);

    // Send Twilio SMS alert to Sly (via messaging service for toll-free verification)
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: `🔔 ${name} just checked in at Uppercuts${phone ? ' (' + phone + ')' : ''}. They're waiting in the lobby.`,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE || 'MG96accd23bb6580b48118f5a597033dcf',
        to: process.env.SLY_PHONE || '+17703340126'
      });
    } catch (err) {
      console.error('Twilio alert error:', err.message);
    }

    return res.status(200).json({ success: true, checkin });
  }

  // GET - admin polls for today's check-ins
  if (req.method === 'GET') {
    const today = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    const todayCheckins = checkins.filter(c => {
      return new Date(c.time).toLocaleDateString('en-US', { timeZone: 'America/New_York' }) === today;
    });
    return res.status(200).json({ checkins: todayCheckins });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
