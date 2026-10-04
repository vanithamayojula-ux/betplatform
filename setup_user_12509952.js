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

async function loginAndSetup() {
  const loginUrl = "https://corporate.bharatenglish.org/api/public/bet-exams/login";
  const loginPayload = {
    username: "12509952@lpu.in",
    password: "12509952",
    appContext: "BET_CORPORATE"
  };

  console.log(`[LOGIN] ${loginUrl}`);
  const res = await customFetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(loginPayload),
  });

  if (!res.ok) {
    console.error(`Login failed with status ${res.status}:`, await res.text());
    return;
  }

  const data = await res.json();
  const token = data.jwtToken || data.token;
  console.log("Login Successful!");
  console.log("Token:", token.slice(0, 50) + "...");
  
  // Read current .env
  let envContent = fs.readFileSync(".env", "utf-8");
  envContent = envContent.replace(/^TOKEN=.*$/m, `TOKEN=Bearer ${token}`);
  fs.writeFileSync(".env", envContent);
  console.log("Updated .env with new token.");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };

  const userId = "12509952";
  const orgSlug = "lpu724598";
  const baseUrl = "https://corporate.bharatenglish.org";

  const speakingSections = [177430, 177435, 177438, 177443, 177432, 177434, 177436, 177437, 177439, 177440, 177441, 177442, 177444, 177445];
  const speakingUnits = [941831, 941832, 941850, 941849, 941829, 941830, 941833, 941834, 941847, 941848];

  let activeSection = null;
  let activeUnit = null;

  for (const sId of speakingSections) {
    for (const uId of speakingUnits) {
      const url = `${baseUrl}/api/orgs/${orgSlug}/users/${userId}/bet-section-insts/${sId}/bet-section-unit-insts/${uId}/bet-section-unit-lesson-insts`;
      try {
        const uRes = await customFetch(url, { headers });
        if (uRes.ok) {
          const list = await uRes.json();
          if (Array.isArray(list) && list.length > 0) {
            console.log(`[MATCH] User ${userId} belongs to Section ${sId}, Unit ${uId} (${list.length} lessons)`);
            if (!activeSection) {
              activeSection = sId;
              activeUnit = uId;
            }
          }
        }
      } catch (e) {}
    }
  }

  console.log(`\nActive Section determined: ${activeSection}`);
  console.log(`Active Unit determined: ${activeUnit}`);

  fs.writeFileSync("user_session_info.json", JSON.stringify({
    userId,
    email: "12509952@lpu.in",
    activeSection,
    activeUnit,
    token: `Bearer ${token}`
  }, null, 2));
}

loginAndSetup();
