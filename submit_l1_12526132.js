import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12526132@lpu.in",
  userPass: "12526132",
  userId: "12526132",
  examId: "684411500",
  lessonInstId: "5562908"
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function submitL1() {
  const loginRes = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" })
  });
  const loginData = await loginRes.json();
  const token = loginData.jwtToken || loginData.token;
  const auth = token.startsWith("Bearer ") ? token : "Bearer " + token;
  const headers = { Authorization: auth, "Content-Type": "application/json" };

  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${CONFIG.examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

  const answersMap = [
    "This person manages daily team communication and assists with work reports.",
    "Project Assistant",
    "Project Coordinator because they track tasks and support team operations."
  ];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ansText = answersMap[i] || "Project Coordinator";
    const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${CONFIG.examId}/answers`;
    const res = await fetch(ansUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "SUBJECTIVE",
        question_uuid: q.uuid,
        subjective_written_answer: ansText
      })
    });
    console.log(`Submitted Q${i+1} answer HTTP: ${res.status}`);
  }

  const submitUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${CONFIG.lessonInstId}/bet-exams/${CONFIG.examId}:submit`;
  const subRes = await fetch(submitUrl, { method: "POST", headers, body: "{}" });
  const subText = await subRes.text();
  console.log(`L1 Submit HTTP: ${subRes.status} | Body: ${subText}`);
}

submitL1().catch(console.error);
