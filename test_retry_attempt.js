import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12526132@lpu.in",
  userPass: "12526132",
  userId: "12526132",
  writingSectionInstId: "176869",
  topic1UnitId: 941805,
  sectionUnitLessonId: 1135,
  lessonInstId: 5562908
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function testRetry() {
  const loginRes = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" })
  });
  const loginData = await loginRes.json();
  const token = loginData.jwtToken || loginData.token;
  const auth = token.startsWith("Bearer ") ? token : "Bearer " + token;
  const headers = { Authorization: auth, "Content-Type": "application/json" };

  // 1. POST to bet-section-unit-lesson-insts to create new lesson inst attempt
  const createInstUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${CONFIG.topic1UnitId}/bet-section-unit-lesson-insts/${CONFIG.sectionUnitLessonId}`;
  console.log(`Testing POST create inst: ${createInstUrl}`);
  const instRes = await fetch(createInstUrl, { method: "POST", headers, body: "{}" });
  console.log(`HTTP ${instRes.status} | Body: ${await instRes.text()}`);

  // 2. Query lessons list again to see if new lesson_inst_id was created
  const listUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${CONFIG.topic1UnitId}/bet-section-unit-lesson-insts`;
  const listRes = await fetch(listUrl, { headers });
  const lessons = await listRes.json();
  console.log("\nUpdated L1 section_unit_lesson_insts:");
  console.log(JSON.stringify(lessons[0].section_unit_lesson_insts, null, 2));
}

testRetry().catch(console.error);
