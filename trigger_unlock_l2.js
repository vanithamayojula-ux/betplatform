import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  authToken: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function run() {
  const examId = "676333350";
  const lessonInstId = "8145524";
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  console.log(`Submitting exam ${examId}...`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: CONFIG.authToken },
    body: "{}",
  });
  const txt = await res.text();
  console.log(`Result (${res.status}): ${txt}`);

  // Now check if L2 is unlocked
  const checkUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/177439/bet-section-unit-insts/941821/bet-section-unit-lesson-insts`;
  const checkRes = await fetch(checkUrl, { headers: { Authorization: CONFIG.authToken } });
  if (checkRes.ok) {
    const list = await checkRes.json();
    console.log("Unit 941821 L1 status:", list[0]?.lesson_status, "L2 status:", list[1]?.lesson_status, "L2 instId:", list[1]?.section_unit_lesson_insts?.[0]?.lesson_inst_id);
  }
}

run();
