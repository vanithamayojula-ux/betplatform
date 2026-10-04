import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  authToken: process.env.TOKEN,
  betSectionInstId: "177439",
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function run() {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.betSectionInstId}/bet-section-unit-insts/941821/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers: { Authorization: CONFIG.authToken } });
  if (res.ok) {
    const list = await res.json();
    console.log(JSON.stringify(list, null, 2));
    fs.writeFileSync("unit_941821_lessons.json", JSON.stringify(list, null, 2));
  }
}

run();
