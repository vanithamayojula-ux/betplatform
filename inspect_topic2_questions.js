import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12517515@lpu.in",
  userPass: "12517515",
  writingSectionInstId: "176869",
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function inspectTopic2Questions() {
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

  // Fetch Topic 2 (Unit 941820) L1 lessons
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${uid}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/941820/bet-section-unit-lesson-insts`;
  const r = await fetch(url, { headers });
  const lessons = await r.json();
  const l1 = lessons[0];
  const inst = (l1.section_unit_lesson_insts || [])[0];
  const lessonInstId = inst.lesson_inst_id;

  console.log(`Creating test exam for Writing Topic 2 L1 (lessonInstId ${lessonInstId})...`);
  const createRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${uid}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`, { method: "POST", headers, body: "{}" });
  const exam = await createRes.json();
  console.log("Created exam:", exam.id);

  const qRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${uid}/bet-exams/${exam.id}/questions`, { headers });
  const qData = await qRes.json();
  const questions = qData.test_definition_section[0].questions;

  for (const q of questions) {
    const prompt = q.question.replace(/<[^>]*>/g, " ").trim();
    const ansText = "Good morning Team, I hope you are having a productive week. Best regards, Arket Abhinay.";
    console.log(`Submitting answer for Q "${prompt.slice(0, 40)}..."`);
    const subRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${uid}/bet-exams/${exam.id}/answers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "SUBJECTIVE",
        question_uuid: q.uuid,
        subjective_written_answer: ansText
      })
    });
    console.log("Answer res status:", subRes.status, await subRes.json());
  }

  console.log("\nSubmitting Exam...");
  const evalRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${uid}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${exam.id}:submit`, {
    method: "POST",
    headers,
    body: "{}"
  });
  console.log("Submit exam response:", await evalRes.text());
}

inspectTopic2Questions().catch(console.error);
