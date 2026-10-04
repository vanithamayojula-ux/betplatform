import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  students: [
    { email: "12517515@lpu.in", pass: "12517515", id: "12517515" },
    { email: "12526132@lpu.in", pass: "12526132", id: "12526132" }
  ],
  writingSectionInstId: "176869",
  targetUnits: [
    { uId: 941805, name: "Topic 1 (Job Descriptions)" },
    { uId: 941820, name: "Topic 2 (Professional Email)" }
  ]
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function loginStudent(s) {
  const res = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: s.email, password: s.pass, appContext: "BET_CORPORATE" })
  });
  if (!res.ok) return null;
  const data = await res.json();
  let rawToken = data.jwtToken || data.token;
  if (!rawToken.startsWith("Bearer ")) rawToken = "Bearer " + rawToken;
  return rawToken;
}

async function checkAll() {
  for (const s of CONFIG.students) {
    const token = await loginStudent(s);
    if (!token) {
      console.log(`Failed to login student ${s.email}`);
      continue;
    }
    const headers = { Authorization: token, "Content-Type": "application/json" };
    console.log(`\n============================================================`);
    console.log(`=== STUDENT ${s.email} (ID: ${s.id}) ===`);
    console.log(`============================================================`);

    let totalDone = 0;
    let totalLessons = 0;

    for (const u of CONFIG.targetUnits) {
      const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${s.id}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
      const res = await fetch(url, { headers });
      const lessons = await res.json();
      const lessonArr = Array.isArray(lessons) ? lessons : (lessons.content || []);

      console.log(`\n--- ${u.name} (Total: ${lessonArr.length}) ---`);
      for (const l of lessonArr) {
        totalLessons++;
        const insts = l.section_unit_lesson_insts || [];
        const latestInst = insts[insts.length - 1] || {};
        const count = l.completed_lessons_count || 0;
        const status = l.lesson_status || latestInst.bet_status;
        const pct = latestInst.percentage;
        const isDone = count > 0 || status === "COMPLETED" || status === "PASSED" || (pct != null && pct >= 85);
        if (isDone) totalDone++;

        console.log(`L${l.seq_no} ("${l.lesson_name}"): status="${status}", count=${count}, pct=${pct}%, IS_DONE=${isDone}`);
      }
    }
    console.log(`\nSUMMARY FOR ${s.id}: ${totalDone} / ${totalLessons} DONE (${Math.round(totalDone/totalLessons * 100)}%)`);
  }
}

checkAll().catch(console.error);
