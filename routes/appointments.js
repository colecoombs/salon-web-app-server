// appointments.js  (ESM)
import { Router } from "express";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const router = Router();

/* ======== ENV ======== */
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET = "PLEASE_SET_A_REAL_SECRET",
} = process.env;

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
 * inserts with status = 'pending'
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
    return res.status(201).json(data);
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

export default router;
