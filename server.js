// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import morgan from "morgan";

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(morgan("dev")); // Logging middleware

// Check for required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.");
  process.exit(1);
}

// Supabase connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // For server-side ops only
);

// Input validation helper
function validateAppointment(body) {
  const { name, phone, service, date, time } = body;
  if (!name || typeof name !== "string") return "Invalid or missing name.";
  if (!phone || typeof phone !== "string") return "Invalid or missing phone.";
  if (!service || typeof service !== "string") return "Invalid or missing service.";
  if (!date || typeof date !== "string") return "Invalid or missing date.";
  if (!time || typeof time !== "string") return "Invalid or missing time.";
  return null;
}


app.get("/api/appointments", async (req, res) => {
  try {
    const { data, error } = await supabase.from("appointments").select("*").order("date", { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("GET /appointments error:", err);
    res.status(500).json({ error: err.message || err });
  }
});

// Get appointments for a specific date
app.get("/api/appointments/date/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("date", date);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("GET /appointments/date/:date error:", err);
    res.status(500).json({ error: err.message || err });
  }
});

app.post("/api/appointments", async (req, res) => {
  const validationError = validateAppointment(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  try {
    const { name, phone, service, date, time } = req.body;
    const { data, error } = await supabase.from("appointments").insert([{ name, phone, service, date, time }]);
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error("POST /appointments error:", err);
    res.status(500).json({ error: err.message || err });
  }
});

app.delete("/api/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /appointments/:id error:", err);
    res.status(500).json({ error: err.message || err });
  }
});

app.listen(port, () => console.log(`Salon backend listening on port ${port}`));
