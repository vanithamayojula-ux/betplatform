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
  examId: "705247050"
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function inspect() {
  let token = null;
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
          token = raw.startsWith("Bearer ") ? raw : "Bearer " + raw;
          break;
        }
      }
    } catch (e) {}
  }
  const headers = { Authorization: token, "Content-Type": "application/json" };

  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${CONFIG.examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

  console.log(`Total questions in exam: ${questions.length}`);
  questions.forEach((q, i) => {
    console.log(`\n=================== Q${i+1} [Type: ${q.type}] ===================`);
    console.log(`Question: ${q.question}`);
    console.log(`Explanation: ${q.explanation}`);
    console.log(`spch: ${JSON.stringify(q.spch)}`);
    console.log(`mcq: ${JSON.stringify(q.mcq)}`);
    console.log(`amcq: ${JSON.stringify(q.amcq)}`);
  });
}

inspect().catch(console.error);
