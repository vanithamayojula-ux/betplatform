import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12505970@lpu.in",
  userPass: "12505970@lpu.in",
  userId: "12505970",
  speakingSectionInstId: "176843",
  targetUnits: [
    { uId: 941831, name: "Speaking Topic 1 (Self Introductions)" },
    { uId: 941832, name: "Speaking Topic 2 (Morning Routine Walkthrough)" }
  ]
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function check() {
  let auth = null;
  const combos = [
    { username: "12505970@lpu.in", password: "12505970@lpu.in" },
    { username: "12505970@lpu.in", password: "12505970" },
    { username: "12505970", password: "12505970@lpu.in" },
    { username: "12505970", password: "12505970" }
  ];
  for (const c of combos) {
    try {
      const loginRes = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: c.username, password: c.password, appContext: "BET_CORPORATE" })
      });
      if (loginRes.ok) {
        const data = await loginRes.json();
        const rawToken = data.jwtToken || data.token || data.id_token;
        if (rawToken) {
          auth = rawToken.startsWith("Bearer ") ? rawToken : "Bearer " + rawToken;
          break;
        }
      }
    } catch (e) {}
  }
  if (!auth) throw new Error("Login failed");
  const headers = { Authorization: auth, "Content-Type": "application/json" };

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.speakingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    const lessons = await res.json();
    console.log(`\n=== ${u.name} (Total: ${lessons.length}) ===`);
    let completed = 0;
    for (const l of lessons) {
      const insts = l.section_unit_lesson_insts || [];
      const inst = insts.slice(-1)[0] || insts[0] || {};
      const status = l.lesson_status || inst.bet_status;
      const pct = inst.percentage;
      const count = l.completed_lessons_count || 0;
      const isDone = count > 0 || status === "COMPLETED" || status === "PASSED" || (pct != null && pct >= 85);
      if (isDone) completed++;
      console.log(`L${l.seq_no} (${l.lesson_name}): status="${status}", pct=${pct}%, count=${count}, isDone=${isDone}`);
    }
    console.log(`Completed in ${u.name}: ${completed} / ${lessons.length}`);
  }
}

check().catch(console.error);
