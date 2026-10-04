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
  lessonInstId: "6293994" // Lesson 10
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function inspectL10() {
  let auth = null;
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
        if (raw) {
          auth = raw.startsWith("Bearer ") ? raw : "Bearer " + raw;
          break;
        }
      }
    } catch (e) {}
  }
  const headers = { Authorization: auth, "Content-Type": "application/json" };

  const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${CONFIG.lessonInstId}/bet-exams`;
  const examRes = await fetch(examUrl, { method: "POST", headers, body: "{}" });
  const examData = await examRes.json();
  console.log(`Created exam: ${examData.id}`);

  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examData.id}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

  console.log(`Questions count: ${questions.length}`);
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\n--- Q${i+1} [Type: ${q.type}] ---`);
    console.log(`Question: ${q.question}`);
    console.log(`Explanation: ${q.explanation}`);
    console.log(`Audio path: ${q.spch?.answer_audio_path}`);
  }
}

inspectL10().catch(console.error);
