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

async function testSubmitUrls() {
  await loginIfNeeded();
  const lessonInstId = "8221622"; // Topic 2 L1
  const lessonId = "1140";
  const testDefId = "9203437";

  // 1. Create Exam
  const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  const examRes = await fetch(examUrl, { method: "POST", headers, body: "{}" });
  const text = await examRes.text();
  let examData = {};
  try { examData = JSON.parse(text); } catch {}
  const examId = String(examData.id || examData.exam_id || examData.examId || examData.betExamId);
  console.log("Created Exam ID:", examId, "Raw Body:", text);

  // 2. Fetch Questions & Submit 1 answer
  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap((s) => s.questions || []);

  for (const q of questions) {
    const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
    await fetch(ansUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "SUBJECTIVE", question_uuid: q.uuid, subjective_written_answer: "Good morning team, I am writing to apply for the role." })
    });
  }

  // 3. Test different submit URLs
  const candidateSubmitUrls = [
    { name: "URL 1 (lessonInstId)", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit` },
    { name: "URL 2 (lessonId)", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonId}/bet-exams/${examId}:submit` },
    { name: "URL 3 (testDefId)", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${testDefId}/bet-exams/${examId}:submit` },
    { name: "URL 4 (direct bet-exams)", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}:submit` }
  ];

  for (const u of candidateSubmitUrls) {
    console.log(`\nTesting ${u.name}: ${u.url}`);
    try {
      const res = await fetch(u.url, { method: "POST", headers, body: "{}" });
      console.log("Status:", res.status, "Text:", await res.text());
    } catch (e) {
      console.log("Error:", e.message);
    }
  }

  // Check if Topic 2 L1 status updated in lesson insts query!
  const checkUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/176869/bet-section-unit-insts/941820/bet-section-unit-lesson-insts`;
  const checkRes = await fetch(checkUrl, { headers });
  const checkLessons = await checkRes.json();
  const l1 = checkLessons.find(l => l.seq_no === 1);
  console.log("\nTopic 2 L1 after test submit:\n", JSON.stringify(l1, null, 2));
}

testSubmitUrls().catch(console.error);
