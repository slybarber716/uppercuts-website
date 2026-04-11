// Appointment storage (uses Netlify environment)
// In production, this would use a database like Firebase or MongoDB

let appointmentsDB = {};

// Load appointments from environment
if (process.env.APPOINTMENTS_DB) {
  try {
    appointmentsDB = JSON.parse(process.env.APPOINTMENTS_DB);
  } catch (e) {
    console.error('Failed to parse appointments DB:', e);
  }
}

// Save appointment
exports.saveAppointment = (appointment) => {
  const id = Date.now().toString();
  appointmentsDB[id] = {
    ...appointment,
    id,
    createdAt: new Date().toISOString(),
    status: 'pending' // pending, confirmed, cancelled, completed
  };
  return appointmentsDB[id];
};

// Get appointments by phone
exports.getAppointmentsByPhone = (phone) => {
  const normalized = phone.replace(/\D/g, '').slice(-10); // Last 10 digits
  return Object.values(appointmentsDB).filter(apt => {
    const aptPhone = apt.phone.replace(/\D/g, '').slice(-10);
    return aptPhone === normalized;
  });
};

// Get appointment by ID
exports.getAppointmentById = (id) => {
  return appointmentsDB[id];
};

// Update appointment status
exports.updateAppointmentStatus = (id, status) => {
  if (appointmentsDB[id]) {
    appointmentsDB[id].status = status;
    appointmentsDB[id].updatedAt = new Date().toISOString();
    return appointmentsDB[id];
  }
  return null;
};

// Get all appointments
exports.getAllAppointments = () => {
  return Object.values(appointmentsDB);
};

// Get appointments by date
exports.getAppointmentsByDate = (date) => {
  return Object.values(appointmentsDB).filter(apt => apt.date === date);
};
