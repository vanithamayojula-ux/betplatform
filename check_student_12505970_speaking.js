import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12505970@lpu.in",
  userPassCombo: [
    { username: "12505970@lpu.in", password: "12505970@lpu.in" },
    { username: "12505970@lpu.in", password: "12505970" },
    { username: "12505970", password: "12505970@lpu.in" },
    { username: "12505970", password: "12505970" }
  ],
  userId: "12505970"
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function checkSpeaking() {
  let auth = null;
  for (const c of CONFIG.userPassCombo) {
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

  // Test speaking section ID 176843 or find speaking section
  const candidateSecIds = ["176843", "176869", "176874", "176800"];
  // Check known units: 941831, 941832, 941829, 941830, 941833
  const candidateUnits = [941831, 941832, 941829, 941830, 941833];

  console.log(`Checking speaking for user ${CONFIG.userId}...`);
  for (const secId of ["176843", "176874", "176869", "176800"]) {
    for (const uId of candidateUnits) {
      const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${secId}/bet-section-unit-insts/${uId}/bet-section-unit-lesson-insts`;
      try {
        const res = await fetch(url, { headers });
        if (res.ok) {
          const lessons = await res.json();
          if (Array.isArray(lessons) && lessons.length > 0) {
            console.log(`FOUND! Section ${secId}, Unit ${uId}: ${lessons.length} lessons. Sample lesson: ${lessons[0].lesson_name}`);
          }
        }
      } catch (e) {}
    }
  }
}

checkSpeaking().catch(console.error);
