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
  const lessonId = 1146; // L2 of Unit 941821
  const unitId = 941821;
  const sectionInstId = 177439;

  const requests = [
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${sectionInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`,
      body: { section_unit_lesson_id: lessonId },
    },
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${sectionInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`,
      body: { lesson_id: lessonId },
    },
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${sectionInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`,
      body: { seq_no: 2 },
    },
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${sectionInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`,
      body: {},
    },
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts`,
      body: { section_unit_lesson_id: lessonId, bet_section_unit_inst_id: unitId },
    },
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${sectionInstId}/bet-exams`,
      body: { test_definition_id: 9203448 },
    },
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${sectionInstId}/bet-section-unit-insts/${unitId}/bet-exams`,
      body: {},
    },
  ];

  for (const r of requests) {
    try {
      const res = await fetch(r.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: CONFIG.authToken },
        body: JSON.stringify(r.body),
      });
      const txt = await res.text();
      console.log(`POST ${r.url} (${JSON.stringify(r.body)}) -> ${res.status}: ${txt.slice(0, 250)}`);
    } catch (e) {
      console.error(e.message);
    }
  }
}

probe();
