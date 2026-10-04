import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPassCombo: [{ username: "12517515@lpu.in", password: "12517515" }],
  authToken: process.env.TOKEN
};

const headers = { "Content-Type": "application/json" };
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function loginIfNeeded() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  for (const c of CONFIG.userPassCombo) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: c.username, password: c.password, appContext: "BET_CORPORATE" }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        const rawToken = data.jwtToken || data.token || data.id_token;
        if (rawToken) {
          const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
          CONFIG.authToken = token;
          headers["Authorization"] = token;
          return token;
        }
      }
    } catch (e) {}
  }
}

async function testFresh() {
  await loginIfNeeded();
  const lessonInstId = "7963390"; // L2
  const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  const examRes = await fetch(examUrl, { method: "POST", headers, body: "{}" });
  const examData = await examRes.json();
  const examId = String(examData.id);
  console.log("Created Fresh Exam ID:", examId);

  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap((s) => s.questions || []);
  console.log("Questions count:", questions.length);

  for (const q of questions) {
    console.log(`\nQuestion type: ${q.type}, uuid: ${q.uuid}`);
    const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
    const bodyPayload = {
      type: "SUBJECTIVE",
      question_uuid: q.uuid,
      subjective_written_answer: "The cleaner cleans rooms, sweeps floors, and collects trash."
    };
    const res = await fetch(ansUrl, { method: "POST", headers, body: JSON.stringify(bodyPayload) });
    const txt = await res.text();
    console.log("Answer Submission Status:", res.status, "Response:", txt);
  }

  // Submit Exam
  const submitUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  const subRes = await fetch(submitUrl, { method: "POST", headers, body: "{}" });
  const subTxt = await subRes.text();
  console.log("\nFinalized Exam Response:", subRes.status, subTxt);
}

testFresh().catch(console.error);
