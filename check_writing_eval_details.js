import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPass: "12517515",
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
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" }),
  });
  const data = await res.json();
  let rawToken = data.jwtToken || data.token || data.id_token;
  if (!rawToken.startsWith("Bearer ")) rawToken = "Bearer " + rawToken;
  CONFIG.authToken = rawToken;
  try {
    const payloadBase64 = rawToken.split(".")[1];
    const payloadJson = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
    if (payloadJson.sub) CONFIG.userId = payloadJson.sub;
  } catch (e) {}
}

async function inspectDetail() {
  await login();
  const headers = { Authorization: CONFIG.authToken, "Content-Type": "application/json" };

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    const lessons = Array.isArray(data) ? data : (data.content || data.lessons || []);

    console.log(`\n============================================================`);
    console.log(`=== ${u.name} (Count: ${lessons.length}) ===`);
    console.log(`============================================================`);

    for (const l of lessons) {
      console.log(`\nL${l.seq_no} ("${l.lesson_name}"): lesson_status="${l.lesson_status}", completed_count=${l.completed_lessons_count}, pending_count=${l.pending_lessons_count}`);
      const insts = l.section_unit_lesson_insts || [];
      insts.forEach((inst, idx) => {
        console.log(`  inst[${idx}]: lesson_inst_id=${inst.lesson_inst_id}, bet_status="${inst.bet_status}", percentage=${inst.percentage}, marks_scored=${inst.marks_scored}, exam_id=${inst.exam_id}, submitTime=${inst.submitTime}`);
      });
    }
  }
}

inspectDetail().catch(console.error);
