const twilio = require('twilio');
const appointmentsDB = require('./appointments');

// Manual function - call when client doesn't show up
// Usage: POST to /.netlify/functions/no-show-alert with { appointmentId }
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Verify it's from admin or Twilio
  // TODO: Add proper auth/verification

  const { appointmentId } = JSON.parse(event.body);
  
  if (!appointmentId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing appointmentId' })
    };
  }

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  const appointment = appointmentsDB.getAppointmentById(appointmentId);
  
  if (!appointment) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Appointment not found' })
    };
  }

  try {
    // Update appointment status
    appointmentsDB.updateAppointmentStatus(appointmentId, 'no-show');

    // Charge no-show fee via Square (admin will do manually for now)
    // TODO: Integrate with Square API for automatic charging

    // Send alert to Sly
    const message = await client.messages.create({
      body: `⚠️ NO-SHOW ALERT\n\nClient: ${appointment.clientName}\nTime: ${appointment.time}\nService: ${appointment.service}\n\nProcess no-show fee in Square.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.OWNER_PHONE // Sly's number
    });

    // Optional: notify client
    await client.messages.create({
      body: `We missed you at your appointment. A $${appointment.noShowFee || 30} no-show fee has been charged to your card. Call us to reschedule!`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: appointment.phone
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'No-show logged and alerts sent'
      })
    };
  } catch (error) {
    console.error('Error processing no-show:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
