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

async function checkDashboard() {
  await loginIfNeeded();

  // 1. All Section Insts
  const sUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts`;
  const sRes = await fetch(sUrl, { headers });
  console.log("Section Insts Status:", sRes.status);
  if (sRes.ok) {
    const sections = await sRes.json();
    console.log("Sections count:", sections.length);
    sections.forEach(s => {
      console.log(`Section [${s.id}] ${s.name || s.section_name}: total=${s.total_lessons_count}, completed=${s.completed_lessons_count}, pct=${s.percentage}`);
    });
  } else {
    console.log("Section Insts Text:", await sRes.text());
  }

  // 2. Writing Units
  const uUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts`;
  const uRes = await fetch(uUrl, { headers });
  console.log("\nWriting Units Status:", uRes.status);
  if (uRes.ok) {
    const units = await uRes.json();
    console.log("Units count:", units.length);
    units.forEach(u => {
      console.log(`Unit [${u.id || u.unit_id}] ${u.name || u.unit_name}: total=${u.total_lessons_count}, completed=${u.completed_lessons_count}, pct=${u.percentage}`);
    });
  } else {
    console.log("Writing Units Text:", await uRes.text());
  }
}

checkDashboard().catch(console.error);
