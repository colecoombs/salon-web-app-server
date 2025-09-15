// server.js  (ESM)
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import morgan from "morgan";
import dotenv from "dotenv";

import adminRoutes from "./routes/admin.js";          // POST /api/login, GET /api/admin/appointments
import appointmentRoutes from "./routes/appointments.js"; // GET/POST/GET-all under /api/appointments

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());
app.use(morgan("dev"));

// (Optional) trust proxy if deploying behind Render/Netlify proxies
app.set("trust proxy", 1);

// --- Basic health check ---
app.get("/health", (_req, res) => res.json({ ok: true }));

// --- Mount routers ---
// NOTE: Both routers are self-contained and connect to Supabase using env vars.
app.use("/api", adminRoutes);
app.use("/api", appointmentRoutes);

// --- 404 handler (after routes) ---
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// --- Error handler ---
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message || "Server error" });
});

app.listen(port, () => {
  console.log(`Salon backend listening on port ${port}`);
});
