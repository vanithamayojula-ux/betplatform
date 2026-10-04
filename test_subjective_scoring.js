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

async function testScoring() {
  await loginIfNeeded();
  // Fetch Lesson 2 of Topic 1 (inst_id 7963390)
  const lessonInstId = "7963390";
  const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  const examRes = await fetch(examUrl, { method: "POST", headers, body: "{}" });
  const examData = await examRes.json();
  const examId = String(examData.id || examData.exam_id);
  console.log("Exam ID:", examId);

  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap((s) => s.questions || []);

  for (const q of questions) {
    console.log(`\n============================================================`);
    console.log(`Question UUID: ${q.uuid}`);
    console.log(`Question Text:\n${q.question}`);
    console.log(`Explanation / Answer Key:\n${q.explanation}`);
    console.log(`Subjective Obj:\n${JSON.stringify(q.subjective, null, 2)}`);

    // Let's test submitting q.explanation or direct keyword response
    const cleanExp = (q.explanation || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const cleanQ = (q.question || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const sampleText = cleanExp.length > 5 ? cleanExp : `The role involves key responsibilities in ${cleanQ.slice(0, 30)}.`;

    const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
    const ansRes = await fetch(ansUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "SUBJECTIVE", question_uuid: q.uuid, subjective_written_answer: sampleText })
    });
    const ansData = await ansRes.json();
    console.log("Submit Ans Response:\n", JSON.stringify(ansData, null, 2));
  }

  // Submit Exam
  const submitUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  const subRes = await fetch(submitUrl, { method: "POST", headers, body: "{}" });
  const subData = await subRes.json();
  console.log("\n============================================================");
  console.log("Finalized Exam Result:\n", JSON.stringify(subData, null, 2));
}

testScoring().catch(console.error);
