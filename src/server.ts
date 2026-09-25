import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import paymentRouter from "./routes/payment";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/payment", paymentRouter);
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Tesla rental payment backend listening on :${port}`);
});
