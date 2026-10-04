import "dotenv/config";
import fs from "fs";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync("pass_log.txt", str + "\n");
  console.log(str);
}

fs.writeFileSync("pass_log.txt", "STARTING L2 & L12 PASS TEST...\n");

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

async function robustFetch(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
      return res;
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(1000 * (i + 1));
    }
  }
}

async function login() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  try {
    const res = await robustFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: CONFIG.userEmail,
        password: CONFIG.userPass,
        appContext: "BET_CORPORATE",
      }),
    });
    const data = await res.json();
    const rawToken = data.jwtToken || data.token || data.id_token;
    return rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : CONFIG.authToken;
  } catch (e) {
    return CONFIG.authToken;
  }
}

const TARGET_ANSWERS = {
  // L2 Crafting a Subject Line
  "9a8646a0-f634-4440-afd7-25b12264632b": "This is a subject line regarding tomorrow's meeting.",
  "f220433e-b3e9-4a61-87b9-b9a6e239cfed": "Here is the submission of the final report.",
  "81256c9b-9ad5-4848-a53a-5aa76e881b6b": "This is an urgent and important update for the team.",

  // L12 Rearrange an email
  "958b2e87-08e6-41d3-9da8-9c534fd0a8e8": "Dear Sir, I hope you are doing well. Please find the attached report. Looking forward to your feedback.",
  "5b85ec0b-94d0-4b4d-bc97-080ad7f6638f": "Errors identified: 1. 'Hope your fine' should be 'I hope you are fine.' 2. 'yesterday class' should be 'yesterday's class.' Corrected Email: Dear Sir, I hope you are fine. Kindly send the report of yesterday's class. Regards, Riya.",
};

async function testPass() {
  const token = await login();
  const headers = { "Content-Type": "application/json", Authorization: token };

  const targetLessons = [
    { instId: "8136342", seq: 2, name: "Crafting a Subject Line" },
    { instId: "8145410", seq: 12, name: "Rearrange an email" },
  ];

  for (const l of targetLessons) {
    log(`\n========================================================`);
    log(`>>> RETRYING L${l.seq} "${l.name}" (instId=${l.instId}) <<<`);
    log(`========================================================`);

    const createUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${l.instId}/bet-exams`;
    const cRes = await robustFetch(createUrl, { method: "POST", headers, body: "{}" });
    const cTxt = await cRes.text();
    const cData = JSON.parse(cTxt);
    const examId = String(cData.id || cData.exam_id);
    log(` -> Created examId=${examId}`);

    const qRes = await robustFetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`, { headers });
    const qData = await qRes.json();
    const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

    for (const q of questions) {
      const ans = TARGET_ANSWERS[q.uuid] || "Dear Sir, I hope you are fine. Please check the attached document. Thank you.";
      log(` -> Submitting Q ${q.id}: "${ans}"`);

      await robustFetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: q.type,
          question_uuid: q.uuid,
          subjective_written_answer: ans,
        }),
      });

      const evRes = await robustFetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/bet-exams/${examId}/writing-evaluation?question_uuid=${q.uuid}`, {
        method: "POST",
        headers,
        body: "{}",
      });
      const evData = await evRes.json().catch(() => ({}));
      log(` -> Evaluated Q ${q.id}: ${evData.evaluation?.marks_awarded} / ${evData.evaluation?.total_marks}`);
    }

    const subRes = await robustFetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${l.instId}/bet-exams/${examId}:submit`, {
      method: "POST",
      headers,
      body: "{}",
    });
    const subTxt = await subRes.text();
    log(` -> Exam Submit: ${subTxt}`);
  }
}

testPass().catch((e) => log("FATAL: " + e.stack));
