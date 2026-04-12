const twilio = require('twilio');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientName, clientPhone } = req.body;
  if (!clientName) {
    return res.status(400).json({ error: 'Missing client name' });
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  try {
    const message = await client.messages.create({
      body: `🔔 CLIENT CHECK-IN\n\n${clientName}${clientPhone ? ` (${clientPhone})` : ''} just arrived at Uppercuts.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.SLY_PHONE
    });

    return res.status(200).json({ success: true, sms_sid: message.sid });
  } catch (error) {
    console.error('Check-in SMS Error:', error);
    return res.status(500).json({ error: 'Failed to send check-in alert' });
  }
};
