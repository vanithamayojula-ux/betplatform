import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  studentId: "9305275",
  authToken: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const endpoints = [
  `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts`,
  `/api/orgs/${CONFIG.orgSlug}/students/${CONFIG.studentId}/bet-section-insts`,
  `/api/orgs/${CONFIG.orgSlug}/bet-tracks`,
  `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-tracks`,
  `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/prep-tracks`,
  `/api/orgs/${CONFIG.orgSlug}/prep-tracks`,
  `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-dashboard`,
  `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/dashboard`,
  `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/courses`,
];

async function run() {
  const out = {};
  for (const ep of endpoints) {
    try {
      const res = await fetch(CONFIG.baseUrl + ep, { headers: { Authorization: CONFIG.authToken } });
      const txt = await res.text();
      out[ep] = { status: res.status, body: txt.slice(0, 500) };
    } catch (e) {
      out[ep] = { error: e.message };
    }
  }
  fs.writeFileSync("probed_endpoints.json", JSON.stringify(out, null, 2));
  console.log("Endpoints probed.");
}

run();
