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

async function testStartEndpoints() {
  await loginIfNeeded();
  const lessonInstId = "8221622"; // Topic 2 L1
  const unitId = "941820";
  const sectionInstId = "176869";

  const endpoints = [
    { method: "POST", path: `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}:start` },
    { method: "POST", path: `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/start` },
    { method: "POST", path: `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${sectionInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts/${lessonInstId}:start` },
    { method: "POST", path: `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${sectionInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts/${lessonInstId}/start` },
    { method: "PUT", path: `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${sectionInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts/${lessonInstId}` },
    { method: "POST", path: `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${sectionInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams` }
  ];

  for (const ep of endpoints) {
    const url = `${CONFIG.baseUrl}${ep.path}`;
    console.log(`\nTesting ${ep.method} [${ep.path}]`);
    try {
      const res = await fetch(url, { method: ep.method, headers, body: "{}" });
      console.log("Status:", res.status, "Text:", await res.text());
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}

testStartEndpoints().catch(console.error);
