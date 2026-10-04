import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12517515@lpu.in",
  userPass: "12517515",
  writingSectionInstId: "176869",
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function solveWritingL1() {
  const loginUrl = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  const res = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" }),
  });

  const data = await res.json();
  const rawToken = data.jwtToken || data.token || data.id_token;
  const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
  const headers = { Authorization: token, "Content-Type": "application/json" };

  const payloadBase64 = token.split(".")[1];
  const payloadJson = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
  const uid = payloadJson.sub || "12517515";

  const lessonInstId = "8221622"; // Topic 2 L1

  console.log(`Creating new exam for Topic 2 L1 (lessonInstId ${lessonInstId})...`);
  const createRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${uid}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`, { method: "POST", headers, body: "{}" });
  const exam = await createRes.json();
  console.log("Created exam ID:", exam.id);

  const qRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${uid}/bet-exams/${exam.id}/questions`, { headers });
  const qData = await qRes.json();
  const questions = qData.test_definition_section[0].questions;

  for (const q of questions) {
    const prompt = q.question.replace(/<[^>]*>/g, " ").trim();
    const ansText = "Dear Team, I am writing to send you a warm morning greeting. I hope you have a successful and productive day ahead.";
    console.log(`Submitting Q "${prompt.slice(0, 30)}..."`);
    const sRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${uid}/bet-exams/${exam.id}/answers`, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "SUBJECTIVE", question_uuid: q.uuid, subjective_written_answer: ansText })
    });
    console.log("Answer status:", sRes.status);
  }

  console.log("Submitting exam...");
  const subRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${uid}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${exam.id}:submit`, {
    method: "POST",
    headers,
    body: "{}"
  });
  console.log("Submit exam response:", await subRes.text());

  // Check updated lesson status
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${uid}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/941820/bet-section-unit-lesson-insts`;
  const r = await fetch(url, { headers });
  const lessons = await r.json();
  const l1 = lessons[0];
  console.log("\nUpdated L1 status:", JSON.stringify(l1, null, 2));
}

solveWritingL1().catch(console.error);
