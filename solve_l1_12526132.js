import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12526132@lpu.in",
  userPass: "12526132",
  userId: "12526132",
  writingSectionInstId: "176869",
  topic1UnitId: 941805
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function run() {
  const loginRes = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" })
  });
  const loginData = await loginRes.json();
  const token = loginData.jwtToken || loginData.token;
  const auth = token.startsWith("Bearer ") ? token : "Bearer " + token;

  const headers = { Authorization: auth, "Content-Type": "application/json" };

  // Fetch L1 inst ID
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${CONFIG.topic1UnitId}/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers });
  const lessons = await res.json();
  const l1 = lessons.find(l => l.seq_no === 1);
  const l1Inst = l1.section_unit_lesson_insts.slice(-1)[0] || l1.section_unit_lesson_insts[0];
  const lessonInstId = l1Inst.lesson_inst_id;

  console.log(`L1 Lesson Inst ID: ${lessonInstId}`);

  // Create new exam
  const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  const examRes = await fetch(examUrl, { method: "POST", headers, body: "{}" });
  const examData = await examRes.json();
  const examId = examData.id;
  console.log(`Created Exam ID for L1: ${examId}`);

  // Fetch Questions
  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

  console.log(`\nL1 Questions (${questions.length}):`);
  questions.forEach((q, idx) => {
    console.log(`\n--- Q${idx+1} ---`);
    console.log(`Question: ${q.question}`);
    console.log(`Explanation: ${q.explanation}`);
  });
}

run().catch(console.error);
