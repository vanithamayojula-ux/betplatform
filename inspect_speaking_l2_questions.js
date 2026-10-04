import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12505970@lpu.in",
  userPass: "12505970@lpu.in",
  userId: "12505970",
  examId: "705246150"
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function inspect() {
  const loginRes = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" })
  });
  const data = await loginRes.json();
  const token = data.jwtToken || data.token || data.id_token;
  const headers = { Authorization: token.startsWith("Bearer ") ? token : "Bearer " + token };

  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${CONFIG.examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

  console.log(`Questions count: ${questions.length}`);
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\n--- Q${i+1} [Type: ${q.type}] ---`);
    console.log(`Question: ${q.question}`);
    console.log(`Explanation: ${q.explanation}`);
    console.log(`Sample Answer / Speech: ${JSON.stringify(q.spch || q.sample_answer || q.speech_meta || q.speech)}`);
  }
}

inspect().catch(console.error);
