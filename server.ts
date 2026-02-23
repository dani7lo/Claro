import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("claro.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS debtors (
    phone TEXT PRIMARY KEY,
    name TEXT,
    value REAL,
    due_date TEXT,
    discount REAL
  );
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Default PIX config
const existingPix = db.prepare("SELECT value FROM config WHERE key = 'pix_key'").get();
if (!existingPix) {
  db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run("pix_key", "");
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post("/api/login", (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: "Telefone é obrigatório." });
    const cleanPhone = phone.toString().replace(/\D/g, "");
    const debtor = db.prepare("SELECT * FROM debtors WHERE phone = ?").get(cleanPhone);
    
    if (debtor) {
      res.json({ success: true, debtor });
    } else {
      res.status(404).json({ success: false, message: "Número não identificado em nossa base de débitos." });
    }
  });

  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    if (password === "net@2025") {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: "Senha incorreta." });
    }
  });

  app.get("/api/admin/debtors", (req, res) => {
    const debtors = db.prepare("SELECT * FROM debtors").all();
    res.json(debtors);
  });

  app.delete("/api/admin/debtors/:phone", (req, res) => {
    const { phone } = req.params;
    try {
      db.prepare("DELETE FROM debtors WHERE phone = ?").run(phone);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post("/api/admin/debtors", (req, res) => {
    const { debtors } = req.body; // Expecting array of objects
    const deleteStmt = db.prepare("DELETE FROM debtors");
    const insertStmt = db.prepare("INSERT INTO debtors (phone, name, value, due_date, discount) VALUES (?, ?, ?, ?, ?)");
    
    const transaction = db.transaction((data) => {
      deleteStmt.run();
      for (const d of data) {
        if (!d.phone) continue;
        insertStmt.run(d.phone.toString().replace(/\D/g, ""), d.name || "", d.value || 0, d.due_date || "", d.discount || 0);
      }
    });

    try {
      transaction(debtors);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post("/api/admin/reset", (req, res) => {
    try {
      db.prepare("DELETE FROM debtors").run();
      db.prepare("DELETE FROM config").run();
      db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run("pix_key", "");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.get("/api/pix-config", (req, res) => {
    const pixKey = db.prepare("SELECT value FROM config WHERE key = 'pix_key'").get() as { value: string };
    const qrCode = db.prepare("SELECT value FROM config WHERE key = 'qr_code'").get() as { value: string };
    res.json({ key: pixKey?.value, qrCode: qrCode?.value });
  });

  app.post("/api/admin/pix-config", (req, res) => {
    const { key, qrCode } = req.body;
    if (key) {
      db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run("pix_key", key);
    }
    if (qrCode) {
      db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run("qr_code", qrCode);
    }
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
