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

async function inspect() {
  const loginRes = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" })
  });
  const loginData = await loginRes.json();
  const token = loginData.jwtToken || loginData.token;
  const auth = token.startsWith("Bearer ") ? token : "Bearer " + token;
  const headers = { Authorization: auth, "Content-Type": "application/json" };

  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${CONFIG.topic1UnitId}/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers });
  const lessons = await res.json();
  
  console.log("Full L1 object:");
  console.log(JSON.stringify(lessons[0], null, 2));
}

inspect().catch(console.error);
