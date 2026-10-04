import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "1252613@lpu.in",
  userPass: "1252613",
  userPassCombos: [
    { username: "1252613@lpu.in", password: "1252613" },
    { username: "1252613@lpu.in", password: "1252613@lpu.in" },
    { username: "1252613", password: "1252613" }
  ]
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function init() {
  let token = null;
  let userId = null;
  
  for (const c of CONFIG.userPassCombos) {
    try {
      const res = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: c.username, password: c.password, appContext: "BET_CORPORATE" }),
      });
      if (res.ok) {
        const data = await res.json();
        const rawToken = data.jwtToken || data.token || data.id_token;
        if (rawToken) {
          token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
          const payloadBase64 = token.split(".")[1];
          const payloadJson = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
          userId = payloadJson.sub || "1252613";
          console.log(`LOGIN OK with username="${c.username}", userId="${userId}"`);
          break;
        }
      }
    } catch (e) {
      console.log(`Failed for ${c.username}: ${e.message}`);
    }
  }

  if (!token) {
    console.error("Could not authenticate student 1252613!");
    return;
  }

  const headers = { Authorization: token, "Content-Type": "application/json" };
  const secUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${userId}/bet-section-insts`;
  const secRes = await fetch(secUrl, { headers });
  if (secRes.ok) {
    const secData = await secRes.json();
    const sections = Array.isArray(secData) ? secData : secData.content || [];
    console.log("\n=== USER SECTIONS ===");
    sections.forEach(s => {
      console.log(`Section: "${s.section_name}" (section_inst_id: ${s.section_inst_id}, id: ${s.id})`);
    });

    const writingSec = sections.find(s => (s.section_name || "").toLowerCase().includes("writing")) || sections[0];
    if (writingSec) {
      const writingInstId = writingSec.section_inst_id || writingSec.id;
      console.log(`\nFound Writing Section Inst ID: ${writingInstId}`);
      
      const unitsUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${userId}/bet-section-insts/${writingInstId}/bet-section-unit-insts`;
      const unitsRes = await fetch(unitsUrl, { headers });
      if (unitsRes.ok) {
        const unitsData = await unitsRes.json();
        const units = Array.isArray(unitsData) ? unitsData : unitsData.content || [];
        console.log("\n=== WRITING UNITS ===");
        units.forEach(u => {
          console.log(`Unit: "${u.unit_name || u.name}" (unit_id / uId: ${u.section_unit_inst_id || u.unit_id || u.id})`);
        });
      }
    }
  } else {
    console.log(`Failed to fetch sections: ${secRes.status}`);
  }
}

init().catch(console.error);
