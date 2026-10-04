import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userPassCombo: [
    { username: "12517515@lpu.in", password: "12517515@lpu.in" },
    { username: "12517515@lpu.in", password: "12517515" },
    { username: "12517515", password: "12517515@lpu.in" },
    { username: "12517515", password: "12517515" }
  ],
  authToken: null,
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b"
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
          const payloadBase64 = token.split(".")[1];
          const payloadJson = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
          if (payloadJson.sub) CONFIG.userId = payloadJson.sub;
          console.log(`Login OK: user=${c.username}, userId=${CONFIG.userId}`);
          return token;
        }
      }
    } catch (e) {}
  }
  console.log("Login failed");
}

async function solveT2L1() {
  await loginIfNeeded();
  const lessonInstId = "8221622";
  console.log(`Creating exam for Topic 2 L1 (inst: ${lessonInstId})...`);
  const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  const res = await fetch(examUrl, { method: "POST", headers, body: "{}" });
  const text = await res.text();
  console.log("Exam creation status:", res.status, "body:", text);
  let d = {};
  try { d = JSON.parse(text); } catch {}
  const examId = d.id || d.exam_id || d.examId || d.betExamId;
  console.log("Exam ID:", examId);
  if (!examId) return;

  // Fetch questions
  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap((s) => s.questions || []);
  console.log("Questions count:", questions.length);

  for (const q of questions) {
    console.log(`Q type: ${q.type}, uuid: ${q.uuid}`);
    const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;

    if (q.type === "SUB" || q.type === "SUBJECTIVE") {
      const payload = { type: "SUBJECTIVE", question_uuid: q.uuid, subjective_written_answer: "Dear Hiring Manager, I am writing to apply for the advertised position." };
      const aRes = await fetch(ansUrl, { method: "POST", headers, body: JSON.stringify(payload) });
      console.log("Subjective Ans Status:", aRes.status, await aRes.text());
    } else {
      const payload = { type: q.type || "MCQ", question_uuid: q.uuid, mcq_selected_answer: 1, amcq_selected_answer: 1 };
      const aRes = await fetch(ansUrl, { method: "POST", headers, body: JSON.stringify(payload) });
      const aData = await aRes.json();
      console.log("MCQ Ans Status:", aRes.status, "pass1:", aData);
      const exact = aData?.mcq?.answer || aData?.amcq?.answer;
      if (exact && exact !== 1) {
        const p2 = { type: q.type || "MCQ", question_uuid: q.uuid, mcq_selected_answer: exact, amcq_selected_answer: exact };
        const aRes2 = await fetch(ansUrl, { method: "POST", headers, body: JSON.stringify(p2) });
        console.log("MCQ Pass 2:", await aRes2.json());
      }
    }
  }

  // Submit
  const subUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  const subRes = await fetch(subUrl, { method: "POST", headers, body: "{}" });
  console.log("Submit status:", subRes.status, await subRes.text());
}

solveT2L1().catch(console.error);
