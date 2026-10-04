import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPassCombo: [
    { username: "12517515@lpu.in", password: "12517515" }
  ],
  authToken: null,
  writingSectionInstId: "176869",
  targetUnits: [
    { uId: 941805, name: "Writing Topic 1 (Writing Job Descriptions)" },
    { uId: 941820, name: "Writing Topic 2 (Professional Email Writing)" }
  ]
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
          const payloadBase64 = token.split(".")[1];
          const payloadJson = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
          if (payloadJson.sub) CONFIG.userId = payloadJson.sub;
          return token;
        }
      }
    } catch (e) {}
  }
}

async function checkDetails() {
  await loginIfNeeded();
  let submittedCount = 0;
  let totalCount = 0;

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    const lessons = await res.json();
    console.log(`\n=== ${u.name} (Total: ${lessons.length}) ===`);
    for (const l of lessons) {
      totalCount++;
      const insts = l.section_unit_lesson_insts || [];
      const submittedInst = insts.find(i => i.bet_status === "PENDING_EVALUATION" || i.bet_status === "COMPLETED" || i.bet_status === "PASSED" || i.submitTime != null || i.exam_id != null) || insts[0] || {};
      const status = submittedInst.bet_status || l.lesson_status;
      const isSubmitted = status === "COMPLETED" || status === "PASSED" || status === "PENDING_EVALUATION" || submittedInst.submitTime != null || submittedInst.exam_id != null;
      if (isSubmitted) submittedCount++;
      console.log(`L${l.seq_no} (${l.lesson_name}): status=${status}, exam_id=${submittedInst.exam_id}, submitted=${isSubmitted}`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`Total Writing Lessons Verified Submitted/Completed: ${submittedCount} / ${totalCount} (${Math.round(submittedCount / totalCount * 100)}%)`);
  console.log(`============================================================`);
}

checkDetails().catch(console.error);
