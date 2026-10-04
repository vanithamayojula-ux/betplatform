import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPassCombo: [{ username: "12517515@lpu.in", password: "12517515" }],
  authToken: process.env.TOKEN
};

const headers = { "Content-Type": "application/json" };
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;
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

async function testSubjective() {
  await loginIfNeeded();
  const examId = "683990250";
  const uuid = "ecde692c-ee18-4d5d-b300-5aebc7347cb1";
  const answerText = "The cleaner keeps the office clean and tidy.";

  const testPayloads = [
    { name: "Payload 1", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`, body: { type: "SUBJECTIVE", question_uuid: uuid, subjective_written_answer: answerText } },
    { name: "Payload 2", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`, body: { type: "SUB", question_uuid: uuid, subjective_written_answer: answerText } },
    { name: "Payload 3", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`, body: { type: "SUBJECTIVE", question_uuid: uuid, answer: answerText } },
    { name: "Payload 4", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`, body: { type: "SUB", question_uuid: uuid, answer: answerText } },
    { name: "Payload 5", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`, body: { type: "SUBJECTIVE", question_uuid: uuid, written_answer: answerText } },
    { name: "Payload 6", url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`, body: { type: "SUB", question_uuid: uuid, text: answerText } },
  ];

  for (const p of testPayloads) {
    console.log(`\nTesting ${p.name}...`);
    try {
      const res = await fetch(p.url, { method: "POST", headers, body: JSON.stringify(p.body) });
      console.log("Status:", res.status, "Text:", await res.text());
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}

testSubjective().catch(console.error);
