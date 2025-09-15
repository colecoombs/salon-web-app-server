const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const appointmentRoutes = require('./routes/appointments');
app.use('/api/appointments', appointmentRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api', adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
