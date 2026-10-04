import https from "https";
import { URL } from "url";
import fs from "fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function customFetch(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: options.method || "GET",
        headers: options.headers || {},
        rejectUnauthorized: false,
        timeout: 15000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: res.headers,
            text: async () => body,
            json: async () => JSON.parse(body),
          })
        );
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${urlStr}`));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

const payloads = [
  { username: "12502296@lpu.in", password: "12502296" },
  { username: "12502296@lpu", password: "12502296" },
  { username: "12502296", password: "12502296" },
  { email: "12502296@lpu.in", password: "12502296" },
  { email: "12502296@lpu", password: "12502296" },
  { identifier: "12502296@lpu.in", password: "12502296" },
  { identifier: "12502296@lpu", password: "12502296" },
  { identifier: "12502296", password: "12502296" },
];

async function run() {
  const url = "https://corporate.bharatenglish.org/api/public/bet-exams/login";
  for (const p of payloads) {
    try {
      const res = await customFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const txt = await res.text();
      console.log(`[${res.status}] payload: ${JSON.stringify(p)} -> ${txt}`);
      if (res.ok) {
        console.log("LOGIN SUCCESS!");
        const data = JSON.parse(txt);
        console.log("Token:", data.token || data.id_token || data.access_token || data.jwt || data);
        fs.writeFileSync("user_auth.json", JSON.stringify({ payload: p, response: data, headers: res.headers }, null, 2));
        return;
      }
    } catch (e) {
      console.log("Err:", e.message);
    }
  }
}

run();
