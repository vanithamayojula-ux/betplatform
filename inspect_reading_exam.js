import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12520776",
  userEmail: "12520776@lpu.in",
  userPass: "12520776",
  authToken: process.env.TOKEN,
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b",
  readingSectionInstId: "176800",
};

const headers = { "Content-Type": "application/json" };
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function loginIfNeeded() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" }),
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

async function main() {
  await loginIfNeeded();
  // Fetch lesson insts for Reading Topic 2 L3 (id 941844)
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.readingSectionInstId}/bet-section-unit-insts/941844/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers });
  const lessons = await res.json();
  const l3 = lessons.find(l => l.seq_no === 3 || l.seq_no === 4);
  const lessonInstId = (l3.section_unit_lesson_insts || [])[0]?.lesson_inst_id;

  console.log(`Creating test exam for lessonInstId ${lessonInstId}...`);
  const createRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`, { method: "POST", headers, body: "{}" });
  const exam = await createRes.json();
  console.log("Created exam:", exam.id);

  const qRes = await fetch(`${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${exam.id}/questions`, { headers });
  const qData = await qRes.json();
  console.log("PBQ questions:");
  console.dir(qData.test_definition_section[0].questions[0].pbq, { depth: 5 });
}

main().catch(console.error);
