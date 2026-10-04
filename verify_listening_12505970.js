import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12505970@lpu.in",
  userPass: "12505970@lpu.in",
  userId: "12505970",
  listeningSectionInstId: "176874",
  targetUnits: [
    { uId: 941823, name: "Topic 1 (Starting the Day Instructions)" },
    { uId: 941828, name: "Topic 2 (First Day at Work)" }
  ]
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function verify() {
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
        const loginData = await loginRes.json();
        const rawToken = loginData.jwtToken || loginData.token || loginData.id_token;
        if (rawToken) {
          auth = rawToken.startsWith("Bearer ") ? rawToken : "Bearer " + rawToken;
          const payloadBase64 = auth.split(".")[1];
          const payloadJson = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
          if (payloadJson.sub) CONFIG.userId = payloadJson.sub;
          break;
        }
      }
    } catch (e) {}
  }
  if (!auth) throw new Error("Could not login");

  const headers = { Authorization: auth, "Content-Type": "application/json" };
  let totalLessons = 0;
  let totalPassed100 = 0;
  let totalPassedAbove85 = 0;

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.listeningSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    const lessons = await res.json();
    const lessonArr = Array.isArray(lessons) ? lessons : (lessons.content || []);

    console.log(`\n=== ${u.name} (Total: ${lessonArr.length}) ===`);
    for (const l of lessonArr) {
      totalLessons++;
      const insts = l.section_unit_lesson_insts || [];
      const inst = insts.slice(-1)[0] || insts[0] || {};
      const status = l.lesson_status || inst.bet_status;
      const pct = inst.percentage;
      const count = l.completed_lessons_count || 0;

      if (pct === 100 || pct === "100") totalPassed100++;
      if ((pct != null && Number(pct) >= 85) || status === "PASSED" || status === "COMPLETED" || count > 0) totalPassedAbove85++;

      console.log(`L${l.seq_no} (${l.lesson_name}): status="${status}", pct=${pct}%, count=${count}, lesson_inst_id=${inst.lesson_inst_id}`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`VERIFICATION RESULT FOR STUDENT 12505970:`);
  console.log(`Total Lessons: ${totalLessons}`);
  console.log(`Passed >= 85%: ${totalPassedAbove85} / ${totalLessons}`);
  console.log(`Scored 100%: ${totalPassed100} / ${totalLessons}`);
  console.log(`============================================================`);
}

verify().catch(console.error);
