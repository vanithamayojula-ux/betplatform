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
    { uId: 941805, name: "Topic 1" },
    { uId: 941820, name: "Topic 2" }
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

async function inspectPrompts() {
  await loginIfNeeded();

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    const lessons = await res.json();

    for (const l of lessons) {
      const insts = l.section_unit_lesson_insts || [];
      const inst = insts.slice(-1)[0] || {};
      const status = inst.bet_status || l.lesson_status;
      const pct = inst.percentage != null ? Number(inst.percentage) : 0;

      if (status !== "COMPLETED" || pct < 85) {
        console.log(`\n============================================================`);
        console.log(`[${u.name} L${l.seq_no}: ${l.lesson_name}] Current Status: ${status}, Score: ${pct}%`);
        try {
          const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${inst.lesson_inst_id}/bet-exams`;
          const examRes = await fetch(examUrl, { method: "POST", headers, body: "{}" });
          const examData = await examRes.json();
          const examId = String(examData.id || examData.exam_id);

          const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
          const qRes = await fetch(qUrl, { headers });
          const qData = await qRes.json();
          const questions = (qData.test_definition_section || []).flatMap((s) => s.questions || []);

          questions.forEach((q, idx) => {
            console.log(` Q${idx + 1}: ${(q.question || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}`);
            if (q.explanation) console.log(`   Explanation: ${q.explanation.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}`);
            if (q.subjective?.explanation) console.log(`   Subj Explanation: ${q.subjective.explanation.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}`);
          });
        } catch (e) {
          console.log(` Error: ${e.message}`);
        }
      }
    }
  }
}

inspectPrompts().catch(console.error);
