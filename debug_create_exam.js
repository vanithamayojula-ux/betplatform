import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPass: "12517515",
  authToken: null,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function login() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" }),
  });
  const data = await res.json();
  let rawToken = data.jwtToken || data.token || data.id_token;
  if (!rawToken.startsWith("Bearer ")) rawToken = "Bearer " + rawToken;
  CONFIG.authToken = rawToken;
}

async function debugCreate() {
  await login();
  const headers = { Authorization: CONFIG.authToken, "Content-Type": "application/json" };
  
  const testInstIds = [
    { name: "Topic 1 L2", instId: "7963390" },
    { name: "Topic 1 L13", instId: "8221611" },
    { name: "Topic 2 L1", instId: "8221622" }
  ];

  for (const t of testInstIds) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${t.instId}/bet-exams`;
    console.log(`\nPosting create exam to ${t.name} (instId: ${t.instId})...`);
    const res = await fetch(url, { method: "POST", headers, body: "{}" });
    const txt = await res.text();
    console.log(`HTTP ${res.status} | Body: ${txt}`);
  }
}

debugCreate().catch(console.error);
