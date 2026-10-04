import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPassCombo: [{ username: "12517515@lpu.in", password: "12517515" }],
  authToken: null,
  writingSectionInstId: "176869",
  targetUnits: [
    { uId: 941805, name: "Topic 1" },
    { uId: 941820, name: "Topic 2" }
  ]
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function login() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "12517515@lpu.in", password: "12517515", appContext: "BET_CORPORATE" }),
  });
  const data = await res.json();
  CONFIG.authToken = data.jwtToken || data.token || data.id_token;
  if (!CONFIG.authToken.startsWith("Bearer ")) CONFIG.authToken = "Bearer " + CONFIG.authToken;
}

async function inspect() {
  await login();
  const headers = { Authorization: CONFIG.authToken, "Content-Type": "application/json" };

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    const lessons = await res.json();
    console.log(`\n=== ${u.name} ===`);
    console.log(JSON.stringify(lessons, null, 2));
  }
}

inspect().catch(console.error);
