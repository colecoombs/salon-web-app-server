// admin.js  (ESM)
import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const router = Router();

/* ======== ENV ======== */
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_USERNAME = "admin",
  ADMIN_PASSWORD_HASH, // bcrypt hash of your real password
  JWT_SECRET = "PLEASE_SET_A_REAL_SECRET",
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[admin.js] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Admin endpoints will fail."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ======== Helpers ======== */
function makeToken(payload) {
  // 2 hours is usually fine for an admin panel
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded; // { username }
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/* ======== Routes ======== */

/**
 * POST /api/login
 * body: { username, password }
 * returns: { token }
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    if (username !== ADMIN_USERNAME) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH || "");
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = makeToken({ username });
    return res.json({ token });
  } catch (err) {
    console.error("POST /login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/admin/appointments
 * header: Authorization: Bearer <token>
 * returns: all appointments (secured)
 */
router.get("/admin/appointments", authMiddleware, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("GET /admin/appointments error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

export default router;
