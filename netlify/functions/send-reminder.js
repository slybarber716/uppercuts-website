const twilio = require('twilio');
const appointmentsDB = require('./appointments');

// Scheduled function - sends appointment reminders 24 hours before
exports.handler = async (event, context) => {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  // Get all appointments
  const allAppointments = appointmentsDB.getAllAppointments();
  
  // Calculate tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Find appointments scheduled for tomorrow
  const tomorrowAppointments = allAppointments.filter(apt => 
    apt.date === tomorrowStr && apt.status === 'confirmed'
  );

  console.log(`Found ${tomorrowAppointments.length} appointments for tomorrow`);

  // Send reminder to each client
  const results = [];
  for (const appointment of tomorrowAppointments) {
    try {
      const message = await client.messages.create({
        body: `Hey! Just a reminder - you have an appointment at Uppercuts tomorrow at ${appointment.time}. See you then! 💈`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: appointment.phone
      });
      results.push({
        success: true,
        appointmentId: appointment.id,
        messageId: message.sid
      });
      console.log(`Reminder sent to ${appointment.phone}`);
    } catch (error) {
      results.push({
        success: false,
        appointmentId: appointment.id,
        error: error.message
      });
      console.error(`Failed to send reminder to ${appointment.phone}:`, error);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Sent ${results.filter(r => r.success).length} reminders`,
      results
    })
  };
};
