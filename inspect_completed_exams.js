import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPassCombo: [{ username: "12517515@lpu.in", password: "12517515" }],
  authToken: null,
  writingSectionInstId: "176869"
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

async function inspectCompleted() {
  await loginIfNeeded();
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/941805/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers });
  const lessons = await res.json();

  const completedLessons = lessons.filter(l => {
    const insts = l.section_unit_lesson_insts || [];
    return insts.some(i => i.bet_status === "COMPLETED" || i.bet_status === "PASSED");
  });

  for (const l of completedLessons) {
    const inst = (l.section_unit_lesson_insts || []).find(i => i.bet_status === "COMPLETED" || i.bet_status === "PASSED");
    console.log(`\nLesson ${l.seq_no} (${l.lesson_name}): exam_id=${inst.exam_id}, status=${inst.bet_status}, pct=${inst.percentage}`);
    if (inst.exam_id) {
      const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${inst.exam_id}`;
      const examRes = await fetch(examUrl, { headers });
      if (examRes.ok) {
        const examDetails = await examRes.json();
        console.log("Exam Details:", JSON.stringify(examDetails, null, 2));
      }
    }
  }
}

inspectCompleted().catch(console.error);
