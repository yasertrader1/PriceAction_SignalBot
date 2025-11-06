// server.js
// Simple webhook receiver for TradingView -> forwards messages to Telegram
// Node.js + Express + Axios

require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;      // تلگرام بات توکن
const CHAT_ID   = process.env.CHAT_ID;        // chat id یا گروه
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ""; // اختیاری، برای اعتبارسنجی

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("Error: BOT_TOKEN and CHAT_ID must be set in environment variables.");
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

async function sendTelegram(text) {
  try {
    const res = await axios.post(TELEGRAM_API, {
      chat_id: CHAT_ID,
      text: text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    }, { timeout: 10000 });
    return res.data;
  } catch (err) {
    console.error("Telegram send error:", err?.response?.data || err.message);
    throw err;
  }
}

// endpoint for TradingView alerts
app.post('/webhook', async (req, res) => {
  try {
    // optional secret header check (if you use it)
    const headerSecret = req.headers['x-webhook-secret'] || req.headers['x-secret'] || "";
    if (WEBHOOK_SECRET && headerSecret !== WEBHOOK_SECRET) {
      console.warn("Rejected webhook call: bad secret header");
      return res.status(403).json({ ok: false, reason: "bad secret" });
    }

    const payload = req.body || {};
    console.log("Received webhook:", JSON.stringify(payload));

    // Typical payloads:
    // 1) { "message": "BUY Signal ..." }
    // 2) custom JSON (symbol, signal, price, ...)
    // Accept both; try to form a friendly message.

    let text = "";
    if (payload.message) {
      text = `<b>TradingView Alert</b>\n\n${payload.message}`;
    } else if (payload.signal || payload.symbol) {
      // build message from fields if provided
      const sig = payload.signal || "Signal";
      const sym = payload.symbol || "";
      const price = payload.price ? `\nPrice: ${payload.price}` : "";
      const tf = payload.tf ? `\nTF: ${payload.tf}` : "";
      text = `<b>${sig}</b>\n${sym}${price}${tf}\n\n(From TradingView)`;
    } else {
      // fallback: stringify full body (but truncated)
      let bodyStr;
      try {
        bodyStr = JSON.stringify(payload);
        if (bodyStr.length > 1500) bodyStr = bodyStr.substring(0,1500) + "...";
      } catch(e) { bodyStr = String(payload); }
      text = `<b>TradingView Alert (raw)</b>\n${bodyStr}`;
    }

    // send to telegram
    await sendTelegram(text);

    return res.json({ ok: true });
  } catch (err) {
    console.error("Webhook handling error:", err.message || err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// health check
app.get('/', (req, res) => res.send("PriceAction_SignalBot is running"));

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
