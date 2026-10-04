import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  authToken: process.env.TOKEN,
};

const headers = {
  "Content-Type": "application/json",
  Authorization: CONFIG.authToken,
};

async function test() {
  const lessonInstId = "6805510";
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  console.log(`[POST] ${url} (create exam)`);
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const data = await res.json();
  console.log("Exam creation response:", data);
  const examId = data.id || data.exam_id || data.examId;

  const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);
  console.log(`Exam ${examId} has ${questions.length} questions:`);
  console.log(JSON.stringify(questions[0], null, 2));
}

test().catch(console.error);
