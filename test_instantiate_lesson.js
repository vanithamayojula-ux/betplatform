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

async function test() {
  const lessonId = 1146; // L2 of Unit 941821
  const endpoints = [
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts`,
      body: { section_unit_lesson_id: lessonId, bet_section_unit_inst_id: 941821, bet_section_inst_id: 177439 },
    },
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.betSectionInstId}/bet-section-unit-insts/941821/bet-section-unit-lesson-insts`,
      body: { section_unit_lesson_id: lessonId },
    },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: CONFIG.authToken },
        body: JSON.stringify(ep.body),
      });
      const txt = await res.text();
      console.log(`POST ${ep.url} -> ${res.status}: ${txt.slice(0, 200)}`);
    } catch (e) {
      console.error("Error:", e.message);
    }
  }
}

test();
