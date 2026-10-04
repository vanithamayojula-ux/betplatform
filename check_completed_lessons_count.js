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

async function checkCompletedCount() {
  await loginIfNeeded();
  let totalLessons = 0;
  let totalCompleted = 0;

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    const lessons = await res.json();

    console.log(`\n============================================================`);
    console.log(`=== ${u.name} (Total: ${lessons.length}) ===`);
    console.log(`============================================================`);

    for (const l of lessons) {
      totalLessons++;
      const isCompleted = l.completed_lessons_count > 0 || l.lesson_status === "COMPLETED" || l.lesson_status === "PASSED";
      if (isCompleted) totalCompleted++;
      console.log(`L${l.seq_no} (${l.lesson_name}): lesson_status="${l.lesson_status}", completed_count=${l.completed_lessons_count}, pending_count=${l.pending_lessons_count} => IS_DONE=${isCompleted}`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`TOTAL DASHBOARD COMPLETED LESSONS: ${totalCompleted} / ${totalLessons} (${Math.round(totalCompleted / totalLessons * 100)}%)`);
  console.log(`============================================================`);
}

checkCompletedCount().catch(console.error);
