import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12505970@lpu.in",
  userPassCombo: [
    { username: "12505970@lpu.in", password: "12505970@lpu.in" },
    { username: "12505970@lpu.in", password: "12505970" },
    { username: "12505970", password: "12505970@lpu.in" },
    { username: "12505970", password: "12505970" }
  ],
  userId: "12505970",
  lessonInstId: "6293992" // Topic 1 Lesson 4
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function login() {
  for (const c of CONFIG.userPassCombo) {
    try {
      const res = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: c.username, password: c.password, appContext: "BET_CORPORATE" })
      });
      if (res.ok) {
        const d = await res.json();
        const raw = d.jwtToken || d.token || d.id_token;
        if (raw) return raw.startsWith("Bearer ") ? raw : "Bearer " + raw;
      }
    } catch (e) {}
  }
}

async function inspectL4() {
  const token = await login();
  const headers = { Authorization: token, "Content-Type": "application/json" };

  // 1. Create exam for L4
  const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${CONFIG.lessonInstId}/bet-exams`;
  const examRes = await fetch(examUrl, { method: "POST", headers, body: "{}" });
  console.log(`Create exam status: ${examRes.status}`);
  const examData = await examRes.json();
  const examId = examData.id;
  console.log(`Created exam ID: ${examId}`);

  // 2. Fetch questions
  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);
  console.log(`Total questions: ${questions.length}`);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\n--- Q${i+1} [${q.type}] ---`);
    console.log(`Question: ${q.question}`);
    console.log(`Explanation: ${q.explanation}`);
    console.log(`Audio path: ${q.spch?.answer_audio_path}`);
  }

  // 3. Test submitting answer to check rate limit
  if (questions.length > 0) {
    const q = questions[0];
    const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
    const ansRes = await fetch(ansUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "SPCH",
        question_uuid: q.uuid,
        spch_selected_answer: "https://images.wexledu.com/qb/20250304111533341.mp3"
      })
    });
    console.log(`\nTest Answer Submit Status: ${ansRes.status}`);
    const txt = await ansRes.text();
    console.log(`Test Answer Response: ${txt}`);
  }
}

inspectL4().catch(console.error);
