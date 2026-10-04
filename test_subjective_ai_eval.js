import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPassCombo: [{ username: "12517515@lpu.in", password: "12517515" }],
  authToken: null
};

const headers = { "Content-Type": "application/json" };
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

async function testAIEval() {
  await loginIfNeeded();
  const lessonInstId = "8221622"; // Topic 2 L1
  const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  const examRes = await fetch(examUrl, { method: "POST", headers, body: "{}" });
  const examData = await examRes.json();
  const examId = String(examData.id || examData.exam_id);
  console.log("Exam ID:", examId);

  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap((s) => s.questions || []);

  const candidateAnswers = [
    "Good morning, Dear Manager. I hope you are having a wonderful day.",
    "Dear Team, Good morning to all of you. I hope you are having a productive day.",
    "Dear John, Good morning and hope you are doing well."
  ];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\nQ${i+1} [${q.uuid}]: ${q.question}`);
    const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
    const ansRes = await fetch(ansUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "SUBJECTIVE",
        question_uuid: q.uuid,
        subjective_written_answer: candidateAnswers[i] || candidateAnswers[0]
      })
    });
    const ansData = await ansRes.json();
    console.log("Response marks_scored:", ansData.marks_scored, "is_correct:", ansData.is_correct);
  }

  // Submit Exam
  const submitUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  const subRes = await fetch(submitUrl, { method: "POST", headers, body: "{}" });
  const subData = await subRes.json();
  console.log("\nSubmitted Exam Result:", JSON.stringify(subData, null, 2));
}

testAIEval().catch(console.error);
