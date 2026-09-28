import path from "path";
import express from "express";
import cors from "cors";
import paymentRouter from "./routes/payment";
import documentsRouter from "./routes/documents";
import vehiclesRouter from "./routes/vehicles";
import { requireAdminKey } from "./middleware/adminAuth";
import { rateLimit } from "./middleware/rateLimit";

export const app = express();

const allowed = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (allowed.length === 0 || process.env.MOCK_MODE === "true") {
  app.use(cors());
} else {
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowed.includes(origin)) return cb(null, true);
        return cb(new Error("CORS not allowed"));
      },
    })
  );
}

app.use(express.json({ limit: "1mb" }));

const publicWriteLimit = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "write" });

app.use("/api/payment/reservations", publicWriteLimit);
app.use("/api/payment/deposit", publicWriteLimit);
app.use("/api/payment/kauce", publicWriteLimit);
app.use("/api/documents", publicWriteLimit);

app.use("/api/payment", paymentRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/vehicles", vehiclesRouter);

app.use("/uploads/documents", requireAdminKey, express.static(path.join(__dirname, "..", "uploads", "documents")));
app.use("/uploads/returns", requireAdminKey, express.static(path.join(__dirname, "..", "uploads", "returns")));

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => res.json({ ok: true }));
