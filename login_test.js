import https from "https";
import { URL } from "url";

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
        timeout: 10000,
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
  { username: "12502296@lpu", password: "12502296" },
  { username: "12502296@lpu.in", password: "12502296" },
  { username: "12502296", password: "12502296" },
  { email: "12502296@lpu.in", password: "12502296" },
  { email: "12502296@lpu", password: "12502296" },
  { username: "12502296@lpu.in", password: "12502296", rememberMe: true },
  { username: "12502296", password: "12502296", rememberMe: true },
];

const urls = [
  "https://corporate.bharatenglish.org/api/authenticate",
  "https://corporate.bharatenglish.org/api/orgs/lpu724598/authenticate",
  "https://corporate.bharatenglish.org/api/login",
  "https://corporate.bharatenglish.org/api/orgs/lpu724598/login",
  "https://corporate.bharatenglish.org/api/auth/login",
  "https://corporate.bharatenglish.org/api/orgs/lpu724598/users/authenticate",
  "https://corporate.bharatenglish.org/api/users/authenticate",
];

async function check() {
  for (const url of urls) {
    for (const p of payloads) {
      try {
        const res = await customFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
        const txt = await res.text();
        console.log(`[${res.status}] ${url} -> ${JSON.stringify(p)}: ${txt.slice(0, 150)}`);
        if (res.ok) {
          console.log("=== SUCCESS ===");
          console.log(txt);
          if (res.headers["authorization"]) {
            console.log("Auth header:", res.headers["authorization"]);
          }
          return;
        }
      } catch (e) {
        console.log(`Error ${url}: ${e.message}`);
      }
    }
  }
}

check();
