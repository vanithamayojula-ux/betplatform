import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  authToken: process.env.TOKEN,
  betSectionInstId: "177434",
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function run() {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.betSectionInstId}/bet-section-unit-insts`;
  const res = await fetch(url, { headers: { Authorization: CONFIG.authToken } });
  const data = await res.json();
  fs.writeFileSync("section_units.json", JSON.stringify(data, null, 2));
  console.log("Section units fetched:", data.length);
}

run();
