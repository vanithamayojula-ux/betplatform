import "dotenv/config";
import https from "https";
import { URL } from "url";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12509952",
  authToken: process.env.TOKEN,
};

const headers = {
  "Content-Type": "application/json",
  Authorization: CONFIG.authToken,
};

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

const speakingSections = [177430, 177435, 177438, 177443, 177432, 177434, 177436, 177437, 177439, 177440, 177441, 177442, 177444, 177445];
const speakingUnits = [941831, 941832, 941850, 941849, 941829, 941830, 941833, 941834, 941847, 941848];

async function run() {
  console.log("Checking Speaking sections for user:", CONFIG.userId);
  let activeSection = null;

  for (const sId of speakingSections) {
    for (const uId of speakingUnits) {
      const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${sId}/bet-section-unit-insts/${uId}/bet-section-unit-lesson-insts`;
      try {
        const res = await customFetch(url, { headers });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            console.log(`[MATCH!] Section ${sId} Unit ${uId} has ${list.length} lessons`);
            activeSection = sId;
            break;
          }
        }
      } catch (e) {}
    }
    if (activeSection) break;
  }

  if (!activeSection) {
    console.log("No active speaking section found in candidate list.");
    return;
  }

  console.log(`\nActive Speaking Section: ${activeSection}`);
  for (const uId of speakingUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${activeSection}/bet-section-unit-insts/${uId}/bet-section-unit-lesson-insts`;
    const res = await customFetch(url, { headers });
    if (res.ok) {
      const list = await res.json();
      console.log(`\n=== Unit ${uId} (${list.length} lessons) ===`);
      for (const l of list) {
        const inst = (l.section_unit_lesson_insts || [])[0];
        const status = inst ? inst.bet_status : l.lesson_status;
        const pct = inst ? inst.percentage : null;
        console.log(`- Lesson ${l.lesson_id}: "${l.lesson_name}" status=${status} pct=${pct} instId=${inst ? inst.id : "N/A"}`);
      }
    }
  }
}

run();
