import "dotenv/config";
import https from "https";

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
  authToken: null,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function login() {
  for (const c of CONFIG.userPassCombo) {
    try {
      const res = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: c.username, password: c.password, appContext: "BET_CORPORATE" })
      });
      if (res.ok) {
        const data = await res.json();
        const rawToken = data.jwtToken || data.token || data.id_token;
        if (rawToken) {
          CONFIG.authToken = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
          console.log(`Login OK for ${c.username}`);
          return CONFIG.authToken;
        }
      }
    } catch (e) {}
  }
}

async function uploadToS3Https(urlStr, buffer) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      let finished = false;
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        resolve({ ok: false, status: 504, body: "Timeout" });
      }, 15000);

      const req = https.request(u, { method: "PUT", headers: { "Content-Length": buffer.length } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body });
        });
      });
      req.on("error", (e) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve({ ok: false, status: 500, body: e.message });
      });
      req.write(buffer);
      req.end();
    } catch (e) {
      resolve({ ok: false, status: 500, body: e.message });
    }
  });
}

async function testUpload() {
  await login();
  const headers = { "Content-Type": "application/json", Authorization: CONFIG.authToken };

  // Google TTS
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent("Hello, I am excited to introduce myself today.")}&tl=en&client=tw-ob`;
  const ttsRes = await fetch(ttsUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
  console.log(`TTS buffer size: ${audioBuffer.length} bytes`);

  // Reserve slot
  const reserveUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userEmail}/speech-question:upload`;
  const reserveRes = await fetch(reserveUrl, { method: "POST", headers, body: "{}" });
  console.log(`Reserve status: ${reserveRes.status}`);
  const slot = await reserveRes.json();
  console.log(`Slot URL exists: ${!!slot.url}`);

  // S3 PUT
  const putRes = await uploadToS3Https(slot.url, audioBuffer);
  console.log(`S3 PUT status: ${putRes.status}, ok: ${putRes.ok}`);
  const finalAudioUrl = slot.previewUrl || (slot.path ? `https://images1.wexledu.com/${slot.path}` : null);
  console.log(`Final audio URL: ${finalAudioUrl}`);
}

testUpload().catch(console.error);
