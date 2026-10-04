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

const app_contexts = [
  "BET_CORPORATE",
  "BET_CAMPUS",
  "BET_COLLEGE",
  "BET",
  "CORPORATE",
  "CAMPUS",
  "COLLEGE",
  "WEB",
  "STUDENT",
  "LPU",
  "lpu724598",
  "PREP",
  "AI_FLUENT_EDGE",
  "CORPORATE_TRAINING",
  "UNIVERSITY",
  "BET_UNIVERSITY"
];

const usernames = [
  "12502296@lpu.in",
  "12502296@lpu",
  "12502296"
];

async function run() {
  const url = "https://corporate.bharatenglish.org/api/public/bet-exams/login";
  for (const ctx of app_contexts) {
    for (const u of usernames) {
      const p = {
        username: u,
        password: "12502296",
        appContext: ctx
      };
      try {
        const res = await customFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
        const txt = await res.text();
        console.log(`[${res.status}] ctx=${ctx} user=${u} -> ${txt}`);
        if (res.ok) {
          console.log("=== LOGIN SUCCESS ===");
          console.log("Found working appContext:", ctx, "and user:", u);
          const data = JSON.parse(txt);
          fs.writeFileSync("user_auth.json", JSON.stringify({ appContext: ctx, user: u, response: data, headers: res.headers }, null, 2));
          return;
        }
      } catch (e) {
        console.log("Err:", e.message);
      }
    }
  }
}

run();
