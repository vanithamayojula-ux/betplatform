import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
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

async function testUpdate() {
  await loginIfNeeded();
  const lessonInstId = "8221622"; // Topic 2 L1

  // Test GET lesson inst
  const getUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}`;
  const gRes = await fetch(getUrl, { headers });
  console.log("GET Lesson Inst Status:", gRes.status, "Body:", await gRes.text());

  // Test PUT / PATCH lesson inst with COMPLETED
  const putUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}`;
  const pRes = await fetch(putUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify({ bet_status: "COMPLETED", percentage: 90, is_latest: true })
  });
  console.log("PUT Lesson Inst Status:", pRes.status, "Body:", await pRes.text());
}

testUpdate().catch(console.error);
