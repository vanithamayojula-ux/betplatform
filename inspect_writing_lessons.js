import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12517515@lpu.in",
  userPass: "12517515",
  writingSectionInstId: "176869",
  targetUnits: [
    { uId: 941805, name: "Writing Topic 1" },
    { uId: 941820, name: "Writing Topic 2" }
  ]
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function inspectWriting() {
  const loginUrl = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  const res = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" }),
  });

  const data = await res.json();
  const rawToken = data.jwtToken || data.token || data.id_token;
  const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
  const headers = { Authorization: token, "Content-Type": "application/json" };

  const payloadBase64 = token.split(".")[1];
  const payloadJson = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
  const uid = payloadJson.sub || "12517515";

  for (const u of CONFIG.targetUnits) {
    console.log(`\n=== ${u.name} (Unit ${u.uId}) ===`);
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${uid}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const r = await fetch(url, { headers });
    if (!r.ok) {
      console.log("Failed to fetch lessons:", r.status);
      continue;
    }
    const lessons = await r.json();
    for (const l of lessons) {
      if (l.seq_no === 1) {
        console.log("Raw JSON for L1:", JSON.stringify(l, null, 2));
      }
      const inst = (l.section_unit_lesson_insts || []).find(i => i.is_latest) || (l.section_unit_lesson_insts || []).slice(-1)[0];
      console.log(`L${l.seq_no} "${l.lesson_name}": lesson_status=${l.lesson_status}, inst_status=${inst?.bet_status || inst?.betStatus}, pct=${inst?.percentage}%`);
    }
  }
}

inspectWriting().catch(console.error);
