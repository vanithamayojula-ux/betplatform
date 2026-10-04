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

async function discover() {
  await loginIfNeeded();

  const endpoints = [
    `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-courses`,
    `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-sections`,
    `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/dashboard`,
    `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts`,
    `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/176869/bet-section-unit-insts/941805/bet-section-unit-lesson-insts`
  ];

  for (const ep of endpoints) {
    const url = `${CONFIG.baseUrl}${ep}`;
    const res = await fetch(url, { headers });
    console.log(`\nEndpoint [${ep}] Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      console.log("Body snippet:", text.slice(0, 300));
    }
  }
}

discover().catch(console.error);
