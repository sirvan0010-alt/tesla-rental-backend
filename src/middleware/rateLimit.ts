import { RequestHandler } from "express";

/** Jednoduchý in-memory rate limit (1 instance procesu). Pro multi-instance později Redis. */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const prefix = options.keyPrefix ?? "rl";

  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${prefix}:${ip}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + options.windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > options.max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: "Příliš mnoho požadavků, zkuste to za chvíli" });
    }
    next();
  };
}
