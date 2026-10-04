import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12505382@lpu.in",
  userPass: "12505382",
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function testSectionInstId() {
  const loginUrl = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  const res = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" }),
  });

  const data = await res.json();
  const rawToken = data.token || data.jwtToken || data.id_token;
  const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
  const headers = { Authorization: token, "Content-Type": "application/json" };

  const payloadBase64 = token.split(".")[1];
  const payloadJson = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
  const uid = payloadJson.sub || "12505382";

  console.log("Testing userId=", uid);

  // Try fetching unit 941831 lessons with sectionInstId 176843
  const secInstId = "176843";
  const unitId = 941831;
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${uid}/bet-section-insts/${secInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`;
  
  const r = await fetch(url, { headers });
  console.log(`Fetch lessons status: ${r.status}`);
  if (r.ok) {
    const lessons = await r.json();
    console.log(`Found ${lessons.length} lessons!`);
    console.log("Sample lesson:", JSON.stringify(lessons[0], null, 2));
  } else {
    console.log("Response:", await r.text());
  }
}

testSectionInstId().catch(console.error);
