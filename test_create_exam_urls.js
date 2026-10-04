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

async function testCreateUrls() {
  await loginIfNeeded();
  const lessonInstId = "7963390"; // Topic 1 L2
  const sectionUnitLessonId = "1136"; // section_unit_lesson_id for Topic 1 L2

  const urls = [
    { name: "URL 1 (lessonInstId)", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams` },
    { name: "URL 2 (sectionUnitLessonId)", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${sectionUnitLessonId}/bet-exams` },
    { name: "URL 3 (unit level)", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/176869/bet-section-unit-insts/941805/bet-section-unit-lesson-insts/${sectionUnitLessonId}/bet-exams` },
    { name: "URL 4 (unit inst level)", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/176869/bet-section-unit-insts/941805/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams` }
  ];

  for (const u of urls) {
    console.log(`\nTesting ${u.name}: ${u.url}`);
    try {
      const res = await fetch(u.url, { method: "POST", headers, body: "{}" });
      console.log("Status:", res.status, "Text:", await res.text());
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}

testCreateUrls().catch(console.error);
