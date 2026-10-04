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

async function testCreateLessonInst() {
  await loginIfNeeded();
  const unitId = "941820"; // Topic 2
  const lessonId = 1140; // Topic 2 L1

  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/176869/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`;
  const payloads = [
    { section_unit_lesson_id: lessonId },
    { lesson_id: lessonId },
    { seq_no: 1 },
    {}
  ];

  for (const p of payloads) {
    console.log(`\nTesting POST lesson inst with payload:`, JSON.stringify(p));
    try {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(p) });
      console.log("Status:", res.status, "Text:", await res.text());
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}

testCreateLessonInst().catch(console.error);
