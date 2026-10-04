import fs from 'fs';

const userEmail = "12520776@lpu.in";
const userPass = "12520776";
const userId = "12520776";
const orgSlug = "lpu724598";

async function setup() {
  console.log(`Logging in for ${userEmail}...`);
  const res = await fetch('https://corporate.bharatenglish.org/api/public/bet-exams/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: userEmail,
      password: userPass,
      appContext: 'BET_CORPORATE'
    })
  });

  if (!res.ok) {
    console.error(`Login failed: ${res.status}`);
    return;
  }

  const data = await res.json();
  const rawToken = data.jwtToken || data.token || data.id_token;
  const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;

  console.log(`Login SUCCESS for ${data.firstName || userId}! Token received.`);

  // Write to .env
  const dotenvContent = `TOKEN=${token}\nGROQ_KEY=${process.env.GROQ_KEY || ""}\n`;
  fs.writeFileSync('.env', dotenvContent, 'utf8');
  console.log('Updated .env with token.');

  // Discover section IDs for student 12520776
  const unitsMap = {
    Reading: 941801,
    Writing: 941805,
    Listening: 941823,
    Speaking: 941831
  };

  const results = {};

  // Scan range 176800 to 177500
  const batchSize = 100;
  for (let start = 176800; start < 177500; start += batchSize) {
    for (const [name, unitId] of Object.entries(unitsMap)) {
      if (results[name]) continue;
      const promises = [];
      for (let secId = start; secId < start + batchSize; secId++) {
        const url = `https://corporate.bharatenglish.org/api/orgs/${orgSlug}/users/${userId}/bet-section-insts/${secId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`;
        promises.push(
          fetch(url, { headers: { authorization: token } }).then(async r => {
            if (r.ok) {
              const d = await r.json();
              if (Array.isArray(d) && d.length > 0) {
                console.log(`FOUND ${name} SectionInstId: ${secId}`);
                results[name] = String(secId);
              }
            }
          }).catch(() => {})
        );
      }
      await Promise.all(promises);
    }
  }

  fs.writeFileSync('sections_12520776.json', JSON.stringify(results, null, 2));
  console.log("FINAL SECTION MAP FOR 12520776:", results);
}

setup();
