// appointments.js  (ESM)
import { Router } from "express";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import twilio from 'twilio';

const router = Router();

/* ======== ENV ======== */
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  SALON_OWNER_PHONE,
} = process.env;

// Initialize Twilio client
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[appointments.js] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ======== Auth helper (Bearer token) ======== */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // { username }
    req.admin = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/* ======== Routes ======== */

/**
 * GET /appointments/date/:date
 * Public endpoint for the booking page.
 * :date must be YYYY-MM-DD
 */
router.get("/appointments/date/:date", async (req, res) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("date", date)
      .order("time", { ascending: true });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("GET /appointments/date/:date error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/**
 * POST /appointments
 * Public create (used by booking form)
 * body: { client, phone, service, date(YYYY-MM-DD), time(HH:MM) }
 * inserts with status = 'pending' and sends SMS to salon owner
 */
router.post("/appointments", async (req, res) => {
  try {
    const { client, phone, service, date, time } = req.body || {};
    if (!client || !phone || !service || !date || !time) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // (Optional) Simple collision check: exact date+time already taken?
    const { data: existing, error: existErr } = await supabase
      .from("appointments")
      .select("id")
      .eq("date", date)
      .eq("time", time)
      .limit(1);
    if (existErr) throw existErr;
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: "Slot already booked" });
    }

    // Create temporary appointment record
    const { data, error } = await supabase
      .from("appointments")
      .insert([
        {
          client,
          phone,
          service,
          date,
          time,
          status: "pending",
          created_at: new Date().toISOString(),
        },
      ])
      .select("*")
      .single();

    if (error) throw error;

    // Send SMS to salon owner for approval
    const message = await twilioClient.messages.create({
      body: `New appointment request:\n
Client: ${client}
Service: ${service}
Date: ${date}
Time: ${time}
Phone: ${phone}\n
Reply YES to approve or NO to deny.`,
      from: TWILIO_PHONE_NUMBER,
      to: SALON_OWNER_PHONE
    });

    // Store the message SID in the appointment record for tracking
    await supabase
      .from("appointments")
      .update({ twilio_message_sid: message.sid })
      .eq("id", data.id);

    return res.status(201).json({ 
      ...data, 
      message: "Appointment request sent for approval. You will receive a confirmation shortly." 
    });
  } catch (err) {
    console.error("POST /appointments error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/**
 * GET /appointments
 * Admin-only: return ALL appointments
 * header: Authorization: Bearer <token>
 */
router.get("/appointments", requireAuth, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("GET /appointments error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/**
 * POST /appointments/sms-webhook
 * Twilio webhook for handling salon owner's SMS responses
 */
router.post("/appointments/sms-webhook", async (req, res) => {
  try {
    const { Body: response, From: from } = req.body;
    
    // Verify the response is from the salon owner
    if (from !== SALON_OWNER_PHONE) {
      return res.status(403).json({ error: "Unauthorized phone number" });
    }

    // Find the pending appointment with the latest message
    const { data: appointments, error: findError } = await supabase
      .from("appointments")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    if (findError) throw findError;
    if (!appointments || appointments.length === 0) {
      return res.status(404).json({ error: "No pending appointments found" });
    }

    const appointment = appointments[0];
    const isApproved = response.toLowerCase().trim() === 'yes';
    const newStatus = isApproved ? 'approved' : 'denied';

    // Update appointment status
    await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", appointment.id);

    // Send response to client
    await twilioClient.messages.create({
      body: `Your appointment request for ${appointment.service} on ${appointment.date} at ${appointment.time} has been ${newStatus}.`,
      from: TWILIO_PHONE_NUMBER,
      to: appointment.phone
    });

    // Send confirmation to salon owner
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>Appointment has been ${newStatus} and the client has been notified.</Message>
      </Response>`);
  } catch (err) {
    console.error("SMS webhook error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

export default router;
