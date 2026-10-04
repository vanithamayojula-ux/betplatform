import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  userEmail: "12505612@lpu.in",
  userPass: "12505612",
  authToken: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const loginRes = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: CONFIG.userEmail,
          password: CONFIG.userPass,
          appContext: "BET_CORPORATE",
        }),
      });
      if (loginRes.ok) {
        const d = await loginRes.json();
        if (d.token) {
          CONFIG.authToken = d.token.startsWith("Bearer ") ? d.token : `Bearer ${d.token}`;
          console.log("Logged in successfully!");
          break;
        }
      }
    } catch (e) {
      console.warn("Login error:", e.message);
      await sleep(1000);
    }
  }

  const sectionIds = [177430, 177431, 177432, 177433, 177434, 177435, 177436, 177437, 177438, 177439, 177440, 177441];
  const found = [];

  for (const sId of sectionIds) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${sId}/bet-section-unit-insts`;
    try {
      const res = await fetch(url, { headers: { Authorization: CONFIG.authToken } });
      if (res.ok) {
        const list = await res.json();
        console.log(`Found Section ${sId}: ${list.length} units`);
        found.push({ sId, count: list.length, units: list });
      }
    } catch (e) {
      console.warn(`Section ${sId} error:`, e.message);
    }
  }

  fs.writeFileSync("found_sections.json", JSON.stringify(found, null, 2));
  console.log("Discovery complete. Found:", found.length, "valid sections.");
}

run().catch(console.error);
