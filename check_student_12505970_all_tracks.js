import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12505970@lpu.in",
  userPass: "12505970@lpu.in",
  userId: "12505970",
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function checkAllTracks() {
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

  const knownSections = [
    { name: "Reading", secId: "176800", units: [{ uId: 941804, name: "Reading Topic 1" }, { uId: 941819, name: "Reading Topic 2" }] },
    { name: "Listening", secId: "176874", units: [{ uId: 941823, name: "Listening Topic 1" }, { uId: 941828, name: "Listening Topic 2" }] },
    { name: "Writing", secId: "176869", units: [{ uId: 941805, name: "Writing Topic 1" }, { uId: 941820, name: "Writing Topic 2" }] }
  ];

  console.log(`=== TRACKS SUMMARY FOR STUDENT 12505970 ===`);
  for (const s of knownSections) {
    let totalDone = 0;
    let totalLessons = 0;
    for (const u of s.units) {
      const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${s.secId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const lessons = await res.json();
        const lessonArr = Array.isArray(lessons) ? lessons : (lessons.content || []);
        for (const l of lessonArr) {
          totalLessons++;
          const insts = l.section_unit_lesson_insts || [];
          const inst = insts.slice(-1)[0] || insts[0] || {};
          const status = l.lesson_status || inst.bet_status;
          const pct = inst.percentage;
          const count = l.completed_lessons_count || 0;
          if (count > 0 || status === "COMPLETED" || status === "PASSED" || (pct != null && pct >= 85)) {
            totalDone++;
          }
        }
      }
    }
    console.log(`Track: ${s.name} (${s.secId}) -> ${totalDone} / ${totalLessons} Lessons Done (${totalLessons > 0 ? Math.round(totalDone/totalLessons * 100) : 0}%)`);
  }
}

checkAllTracks().catch(console.error);
