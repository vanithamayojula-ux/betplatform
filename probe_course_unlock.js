import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  authToken: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function probe() {
  const urls = [
    `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts`,
    `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/177439/bet-section-unit-insts`,
    `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/177439/bet-section-unit-insts/941821`,
    `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/177439/bet-section-unit-insts/941821/bet-section-unit-lesson-insts`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Authorization: CONFIG.authToken } });
      const txt = await res.text();
      console.log(`GET ${url} -> ${res.status}: ${txt.slice(0, 300)}`);
    } catch (e) {
      console.error(e.message);
    }
  }
}

probe();
