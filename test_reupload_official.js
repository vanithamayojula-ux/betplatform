import "dotenv/config";
import https from "https";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12505970@lpu.in",
  userPass: "12505970@lpu.in",
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function test() {
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
        const d = await loginRes.json();
        const raw = d.jwtToken || d.token || d.id_token;
        if (raw) {
          auth = raw.startsWith("Bearer ") ? raw : "Bearer " + raw;
          break;
        }
      }
    } catch (e) {}
  }

  // 1. Fetch official audio
  const officialUrl = "https://images.wexledu.com/qb/20250408084157751.mp3";
  const audioRes = await fetch(officialUrl);
  console.log(`Audio fetch status: ${audioRes.status}, Content-Type: ${audioRes.headers.get("content-type")}`);
  const buffer = Buffer.from(await audioRes.arrayBuffer());
  console.log(`Buffer length: ${buffer.length} bytes`);

  // 2. Reserve upload slot
  const reserveUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userEmail}/speech-question:upload`;
  const reserveRes = await fetch(reserveUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: "{}"
  });
  console.log(`Reserve status: ${reserveRes.status}`);
  const slot = await reserveRes.json();
  console.log(`Slot URL: ${slot.url}`);

  // 3. PUT using native fetch
  try {
    const fetchPut = await fetch(slot.url, {
      method: "PUT",
      headers: { "Content-Length": String(buffer.length) },
      body: buffer
    });
    console.log(`Native fetch PUT status: ${fetchPut.status}`);
    const putTxt = await fetchPut.text();
    console.log(`Native fetch PUT text: ${putTxt}`);
  } catch (e) {
    console.error(`Native fetch PUT error: ${e.message}`);
  }
}

test().catch(console.error);
