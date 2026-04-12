const twilio = require('twilio');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { Body, From, To } = req.body;
  if (!Body || !From) {
    return res.status(400).json({ error: 'Missing SMS data' });
  }

  const command = Body.trim().toUpperCase();
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  // Sly's READY command — notify client they're up
  if (From === process.env.SLY_PHONE && command.startsWith('READY ')) {
    try {
      const encodedData = Body.trim().substring(6).trim();
      const clientData = JSON.parse(Buffer.from(encodedData, 'base64').toString('utf-8'));
      await client.messages.create({
        body: `✓ Hey ${clientData.name}, you're up! Come on in 👌`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: clientData.phone || From
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Ready error:', err);
      return res.status(500).json({ error: 'Failed to send ready message' });
    }
  }

  // Client commands
  let response = '';
  switch (command) {
    case 'HELP':
      response = `Hi! Here are your Uppercuts commands:\n\nUPCOMING - See your upcoming appointments\nCANCEL - Cancel an appointment\nHELP - Show this menu\n\nOr visit uppercutsbysly.com`;
      break;
    case 'UPCOMING':
      response = `Check your upcoming appointments at uppercutsbysly.com or text Sly to confirm.`;
      break;
    default:
      if (command.startsWith('CANCEL')) {
        response = `To cancel, please visit uppercutsbysly.com or text Sly directly. We ask for at least 2 hours notice. Thanks!`;
      } else {
        response = `Hey! Thanks for texting Uppercuts 💈\nReply HELP for commands or book at uppercutsbysly.com`;
      }
  }

  try {
    await client.messages.create({
      body: response,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: From
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('SMS error:', err);
    return res.status(500).json({ error: 'Failed to send SMS' });
  }
};
