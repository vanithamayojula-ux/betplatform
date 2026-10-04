import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPass: "12517515",
  authToken: null,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function login() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" }),
  });
  const data = await res.json();
  let rawToken = data.jwtToken || data.token || data.id_token;
  if (!rawToken.startsWith("Bearer ")) rawToken = "Bearer " + rawToken;
  CONFIG.authToken = rawToken;
}

async function inspectExams() {
  await login();
  const headers = { Authorization: CONFIG.authToken, "Content-Type": "application/json" };
  const targetExams = [
    { name: "Topic 1 L1 (Passed 90%)", examId: "664371700" },
    { name: "Topic 1 L5 (Passed 86.67%)", examId: "679006050" },
    { name: "Topic 1 L2 (Failed 76.67%)", examId: "664467350" },
    { name: "Topic 1 L3 (Failed 63.33%)", examId: "664486200" }
  ];

  for (const t of targetExams) {
    console.log(`\n============================================================`);
    console.log(`=== ${t.name} (Exam: ${t.examId}) ===`);
    console.log(`============================================================`);
    const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${t.examId}/questions`;
    const res = await fetch(qUrl, { headers });
    if (res.ok) {
      const qData = await res.json();
      const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);
      questions.forEach((q, i) => {
        console.log(`\nQ${i+1} UUID: ${q.uuid}`);
        console.log(`Question: ${q.question}`);
        console.log(`Explanation: ${q.explanation}`);
        console.log(`Sample/Model Answer: ${JSON.stringify(q.subjective || q.sa || q.answer || q.sample_answer)}`);
      });
    } else {
      console.log(`HTTP ${res.status}`);
    }
  }
}

inspectExams().catch(console.error);
