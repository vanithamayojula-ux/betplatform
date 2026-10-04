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
    { uId: 941805, name: "Topic 1 (Job Descriptions)" },
    { uId: 941820, name: "Topic 2 (Professional Email)" }
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
          return token;
        }
      }
    } catch (e) {}
  }
}

async function checkEvaluations() {
  await loginIfNeeded();
  let doneCount = 0;
  let pendingCount = 0;
  let totalCount = 0;

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    const lessons = await res.json();

    console.log(`\n=== ${u.name} (Total: ${lessons.length}) ===`);
    for (const l of lessons) {
      totalCount++;
      const insts = l.section_unit_lesson_insts || [];
      const latestInst = insts.find(i => i.is_latest) || insts.slice(-1)[0] || insts[0] || {};
      const status = latestInst.bet_status || l.lesson_status;
      const pct = latestInst.percentage;
      const isDone = (status === "COMPLETED" || status === "PASSED" || l.lesson_status === "COMPLETED") && pct != null && pct >= 85;
      const isPending = status === "PENDING_EVALUATION" || latestInst.submitTime != null;

      if (isDone) doneCount++;
      else if (isPending) pendingCount++;

      console.log(`L${l.seq_no} (${l.lesson_name}): status="${status}", pct=${pct}%, lesson_status="${l.lesson_status}", isDone=${isDone}, isPending=${isPending}`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`DONE (Passed >=85%): ${doneCount} / ${totalCount} (${Math.round(doneCount / totalCount * 100)}%)`);
  console.log(`PENDING EVALUATION: ${pendingCount} / ${totalCount}`);
  console.log(`TOTAL SUBMITTED/PROCESSING: ${doneCount + pendingCount} / ${totalCount}`);
  console.log(`============================================================`);
}

checkEvaluations().catch(console.error);
