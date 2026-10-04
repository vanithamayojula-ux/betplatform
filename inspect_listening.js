import fs from 'fs';

const userEmail = "12519446@lpu.in";
const userPass = "12519446";

async function run() {
  const logStream = fs.createWriteStream('login_out.txt');
  const log = (msg) => { logStream.write(msg + '\n'); console.log(msg); };

  log(`Logging in for ${userEmail}...`);
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
    const errText = await res.text();
    log(`Login failed (${res.status}): ${errText}`);
    return;
  }

  const data = await res.json();
  const rawToken = data.jwtToken || data.token || data.id_token;
  const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;

  log(`Login SUCCESS! User ID: ${data.userId || '12519446'}`);

  // Update .env file with new token
  let dotenv = fs.readFileSync('.env', 'utf8');
  dotenv = dotenv.replace(/TOKEN=.*/, `TOKEN=${token}`);
  fs.writeFileSync('.env', dotenv, 'utf8');
  log('Updated .env with new token.');

  // Fetch student sections (courses)
  const orgSlug = "lpu724598";
  const userId = "12519446";
  const sectionsRes = await fetch(`https://corporate.bharatenglish.org/api/orgs/${orgSlug}/users/${userId}/bet-section-insts`, {
    headers: { authorization: token }
  });

  if (sectionsRes.ok) {
    const sections = await sectionsRes.json();
    log('\n--- User Sections ---');
    fs.writeFileSync('user_sections_dump.json', JSON.stringify(sections, null, 2));
    log('Wrote user_sections_dump.json successfully.');
  } else {
    log(`Fetch sections failed: ${sectionsRes.status}`);
  }
}

run();
