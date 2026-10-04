import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12526132@lpu.in",
  userPass: "12526132",
  userId: "12526132",
  writingSectionInstId: "176869",
  targetUnits: [
    { uId: 941805, name: "Topic 1 (Job Posts)" },
    { uId: 941820, name: "Topic 2 (Professional Email)" }
  ]
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function verify() {
  const loginRes = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" })
  });
  const loginData = await loginRes.json();
  const token = loginData.jwtToken || loginData.token;
  const auth = token.startsWith("Bearer ") ? token : "Bearer " + token;

  const headers = { Authorization: auth, "Content-Type": "application/json" };
  let totalLessons = 0;
  let totalSubmitted = 0;
  let totalCompleted = 0;

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    const lessons = await res.json();
    const lessonArr = Array.isArray(lessons) ? lessons : (lessons.content || []);

    console.log(`\n=== ${u.name} (Total: ${lessonArr.length}) ===`);
    for (const l of lessonArr) {
      totalLessons++;
      const insts = l.section_unit_lesson_insts || [];
      const latestInst = insts[insts.length - 1] || {};
      const status = l.lesson_status || latestInst.bet_status;
      const count = l.completed_lessons_count || 0;
      const isDone = count > 0 || status === "COMPLETED" || status === "PASSED";
      const hasPendingOrSubmitted = insts.some(i => i.submitTime != null || i.exam_id != null || i.bet_status === "PENDING_EVALUATION");
      
      if (isDone) totalCompleted++;
      if (isDone || hasPendingOrSubmitted) totalSubmitted++;

      console.log(`L${l.seq_no} (${l.lesson_name}): status="${status}", count=${count}, attempts=${insts.length}, latestExamId=${latestInst.exam_id}, submitTime=${latestInst.submitTime}`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`STUDENT 12526132 VERIFICATION RESULT:`);
  console.log(`Total Lessons Processed / Submitted: ${totalSubmitted} / ${totalLessons}`);
  console.log(`Completed Count (Passed Backend Batch Grading): ${totalCompleted} / ${totalLessons}`);
  console.log(`============================================================`);
}

verify().catch(console.error);
