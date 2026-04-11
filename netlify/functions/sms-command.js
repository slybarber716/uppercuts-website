const twilio = require('twilio');
const appointmentsDB = require('./appointments');

// SMS Command Handler for Twilio Webhook
exports.handler = async (event, context) => {
  // Parse incoming SMS
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  const { Body, From, To } = body;
  
  if (!Body || !From) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing SMS data' })
    };
  }

  const command = Body.trim().toUpperCase();
  let response = '';

  // Find appointments for this phone number
  const clientAppointments = appointmentsDB.getAppointmentsByPhone(From);

  switch (command) {
    case 'HELP':
      response = `Hi! Here are your Uppercuts commands:\n\nCONFIRM [ID] - Confirm your appointment\nCANCEL [ID] - Cancel an appointment\nUPCOMING - See your upcoming appointments\nHELP - Show this menu`;
      break;

    case 'UPCOMING':
      if (clientAppointments.length === 0) {
        response = `You have no upcoming appointments. Visit uppercutsbysly.com to book!`;
      } else {
        const list = clientAppointments
          .map((apt, i) => `${i + 1}. ${apt.date} at ${apt.time} (${apt.service})`)
          .join('\n');
        response = `Your appointments:\n${list}\n\nReply CONFIRM [#] or CANCEL [#]`;
      }
      break;

    default:
      if (command.startsWith('CONFIRM')) {
        const confirmId = command.split(' ')[1];
        if (confirmId && clientAppointments[confirmId - 1]) {
          const apt = clientAppointments[confirmId - 1];
          appointmentsDB.updateAppointmentStatus(apt.id, 'confirmed');
          response = `✓ Appointment confirmed! See you soon at Uppercuts!`;
        } else {
          response = `Invalid appointment ID. Reply UPCOMING to see your appointments.`;
        }
      } else if (command.startsWith('CANCEL')) {
        const cancelId = command.split(' ')[1];
        if (cancelId && clientAppointments[cancelId - 1]) {
          const apt = clientAppointments[cancelId - 1];
          appointmentsDB.updateAppointmentStatus(apt.id, 'cancelled');
          response = `Your appointment has been cancelled. We're here when you need us!`;
        } else {
          response = `Invalid appointment ID. Reply UPCOMING to see your appointments.`;
        }
      } else {
        response = `I didn't understand that. Reply HELP for available commands.`;
      }
      break;
  }

  // Send response SMS using Twilio client
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
  try {
    await client.messages.create({
      body: response,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: From
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: response })
    };
  } catch (error) {
    console.error('SMS Send Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send SMS response' })
    };
  }
};
