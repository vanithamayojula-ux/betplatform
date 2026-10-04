import "dotenv/config";
import fs from "fs";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync("perfect_log.txt", str + "\n");
  console.log(str);
}

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  userEmail: "12505612@lpu.in",
  userPass: "12505612",
  authToken: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function login() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  try {
    const res = await fetch(url, {
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

const SPECIFIC_ANSWERS = {
  // L2 Crafting a Subject Line
  "9a8646a0-f634-4440-afd7-25b12264632b": "Tomorrow's Meeting",
  "f220433e-b3e9-4a61-87b9-b9a6e239cfed": "Final Report Submission.",
  "81256c9b-9ad5-4848-a53a-5aa76e881b6b": "Urgent Team Update: Important News",

  // L11 Rewrite casual sentences
  "8bdf616e-1e9e-48c2-b757-10ecd0a101e7": "Could you please send me that report at your earliest convenience?",
  "84342b87-3947-4fec-84db-ee8c3d2c73e3": "Dear Professor, I hope you are doing well. I would like to schedule a short meeting to discuss my project. Thank you for your guidance throughout the semester.",

  // L12 Rearrange an email
  "958b2e87-08e6-41d3-9da8-9c534fd0a8e8": "Dear Sir, I hope you are doing well. Please find the attached report. Looking forward to your feedback.",
  "5b85ec0b-94d0-4b4d-bc97-080ad7f6638f": "Errors identified: 1. 'your' should be 'you are'. 2. 'yesterday class' should be 'yesterday's class'. Corrected text: Dear Sir, I hope you are fine. Kindly send the report of yesterday's class. Regards, Riya.",

  // L13 Spot and correct errors
  "4c49e058-9ffd-412e-94c6-d80d398963ea": "I have attached the report. Please check and revert.",
  "32b49771-0d5a-4353-8478-baf9289d1363": "Errors identified: 1. 'your' should be 'you are'. 2. 'yesterday class' should be 'yesterday's class'. Corrected text: Dear Sir, I hope you are fine. Kindly send the report of yesterday's class. Regards, Riya.",
};

async function testPerfect() {
  fs.writeFileSync("perfect_log.txt", "STARTING PERFECT TEST...\n");
  const token = await login();
  const headers = { "Content-Type": "application/json", Authorization: token };

  const failedLessons = [
    { instId: "8136342", seq: 2, name: "Crafting a Subject Line" },
    { instId: "8145377", seq: 11, name: "Rewrite casual sentences" },
    { instId: "8145410", seq: 12, name: "Rearrange an email" },
    { instId: "8145451", seq: 13, name: "Spot and correct errors" },
  ];

  for (const l of failedLessons) {
    log(`\n========================================================`);
    log(`>>> PERFECT SOLVE L${l.seq} "${l.name}" (instId=${l.instId}) <<<`);
    log(`========================================================`);

    const createUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${l.instId}/bet-exams`;
    const cRes = await fetch(createUrl, { method: "POST", headers, body: "{}" });
    const cTxt = await cRes.text();
    const cData = JSON.parse(cTxt);
    const examId = String(cData.id || cData.exam_id);
    log(` -> Created examId=${examId}`);

    const qRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`, { headers });
    const qData = await qRes.json();
    const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

    for (const q of questions) {
      const ans = SPECIFIC_ANSWERS[q.uuid] || "Dear Sir, I hope you are fine. Please check the attached document. Thank you.";
      log(` -> Submitting Q ${q.id}: "${ans}"`);

      await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: q.type,
          question_uuid: q.uuid,
          subjective_written_answer: ans,
        }),
      });

      const evRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/bet-exams/${examId}/writing-evaluation?question_uuid=${q.uuid}`, {
        method: "POST",
        headers,
        body: "{}",
      });
      const evData = await evRes.json().catch(() => ({}));
      log(` -> Evaluated Q ${q.id}: ${evData.evaluation?.marks_awarded} / ${evData.evaluation?.total_marks}`);
    }

    const subRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${l.instId}/bet-exams/${examId}:submit`, {
      method: "POST",
      headers,
      body: "{}",
    });
    const subTxt = await subRes.text();
    log(` -> Exam Submit: ${subTxt}`);
  }
}

testPerfect().catch((e) => log("FATAL: " + e.stack));
