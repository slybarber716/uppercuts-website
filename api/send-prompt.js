const twilio = require('twilio');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing phone number or message' });
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const phone = to.replace(/\D/g, '');

  try {
    const msg = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: '+1' + phone
    });
    return res.status(200).json({ success: true, sid: msg.sid });
  } catch (err) {
    console.error('Prompt SMS error:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
};
