const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Get all appointments
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('appointments').select('*');
  if (error) return res.status(500).json({ error });
  res.json(data);
});

// Create appointment
router.post('/', async (req, res) => {
  const { client, service, date, time, phone } = req.body;
  try {
    const { data, error } = await supabase.from('appointments').insert([
      { client, service, date, time, phone }
    ]);
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error });
    }
    res.status(201).json(data);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single appointment by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return res.status(404).json({ error: 'Appointment not found' });
  res.json(data);
});

// Update appointment by ID
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { customer_name, service, date, time } = req.body;
  const { data, error } = await supabase
    .from('appointments')
    .update({ customer_name, service, date, time })
    .eq('id', id)
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

// Delete appointment by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id);
  if (error) return res.status(400).json({ error });
  res.status(204).send();
});

// Get appointments for a specific date
router.get('/date/:date', async (req, res) => {
  const { date } = req.params;
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('date', date);
  if (error) return res.status(500).json({ error });
  res.json(data);
});

module.exports = router;
