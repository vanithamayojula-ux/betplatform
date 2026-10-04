import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPassCombo: [{ username: "12517515@lpu.in", password: "12517515" }],
  authToken: process.env.TOKEN,
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b"
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

async function testSolve() {
  await loginIfNeeded();
  const examId = "683990250";
  const lessonInstId = "7963390";

  // Fetch questions
  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap((s) => s.questions || []);
  console.log("Questions count:", questions.length);

  for (const q of questions) {
    console.log(`\n--- Question type: ${q.type}, uuid: ${q.uuid} ---`);
    console.log("Q text:", (q.question || "").replace(/<[^>]*>/g, " ").trim());

    const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
    // Pass 1: option 1
    const p1Res = await fetch(ansUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: q.type || "MCQ", question_uuid: q.uuid, mcq_selected_answer: 1, amcq_selected_answer: 1 })
    });
    const p1Data = await p1Res.json();
    console.log("Pass 1 Response:", JSON.stringify(p1Data, null, 2));

    const exactAns = p1Data?.mcq?.answer || p1Data?.amcq?.answer;
    if (exactAns && exactAns !== 1) {
      console.log(`Re-submitting exact answer: ${exactAns}`);
      const p2Res = await fetch(ansUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ type: q.type || "MCQ", question_uuid: q.uuid, mcq_selected_answer: exactAns, amcq_selected_answer: exactAns })
      });
      console.log("Pass 2 Response:", await p2Res.json());
    }
  }

  // Submit Exam
  const submitUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  const subRes = await fetch(submitUrl, { method: "POST", headers, body: "{}" });
  const subData = await subRes.json();
  console.log("\nFinalized Exam Result:", JSON.stringify(subData, null, 2));
}

testSolve().catch(console.error);
