import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12526132@lpu.in",
  userPass: "12526132",
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function inspectStudent() {
  const loginRes = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" })
  });
  const loginData = await loginRes.json();
  const token = loginData.jwtToken || loginData.token;
  const auth = token.startsWith("Bearer ") ? token : "Bearer " + token;
  const payloadBase64 = auth.split(".")[1];
  const payloadJson = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
  const userId = payloadJson.sub || "12526132";

  console.log(`Login OK. userId=${userId}`);
  const headers = { Authorization: auth, "Content-Type": "application/json" };

  // 1. Try public/user course sections
  const res1 = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${userId}/bet-section-insts`, { headers });
  console.log(`bet-section-insts status: ${res1.status}`);
  console.log(`bet-section-insts body: ${await res1.text()}`);

  // 2. Try fetching unit 941805 directly
  const res2 = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${userId}/bet-section-insts/176869/bet-section-unit-insts/941805/bet-section-unit-lesson-insts`, { headers });
  console.log(`\nUnit 941805 status: ${res2.status}`);
  const txt2 = await res2.text();
  console.log(`Unit 941805 body snippet: ${txt2.slice(0, 300)}`);
}

inspectStudent().catch(console.error);
