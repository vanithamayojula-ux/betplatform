import fs from 'fs';

const userEmail = "12519446@lpu.in";
const userPass = "12519446";

async function loginAndSetup() {
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
    const errText = await res.text();
    console.error(`Login failed (${res.status}): ${errText}`);
    return;
  }

  const data = await res.json();
  const rawToken = data.jwtToken || data.token || data.id_token;
  const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;

  console.log(`Login SUCCESS! User ID: ${data.userId || '12519446'}`);
  console.log(`Token received: ${token.slice(0, 50)}...`);

  // Update .env file with new token
  let dotenv = fs.readFileSync('.env', 'utf8');
  dotenv = dotenv.replace(/TOKEN=.*/, `TOKEN=${token}`);
  fs.writeFileSync('.env', dotenv, 'utf8');
  console.log('Updated .env with new token.');

  // Fetch student sections (courses)
  const orgSlug = "lpu724598";
  const userId = "12519446";
  const sectionsRes = await fetch(`https://corporate.bharatenglish.org/api/orgs/${orgSlug}/users/${userId}/bet-section-insts`, {
    headers: { authorization: token }
  });

  if (sectionsRes.ok) {
    const sections = await sectionsRes.json();
    console.log('\n--- User Sections ---');
    console.log(JSON.stringify(sections.map(s => ({
      section_inst_id: s.section_inst_id || s.id,
      section_name: s.section_name || s.name,
      section_id: s.section_id,
      percentage: s.percentage,
      total_units: s.total_units_count,
      completed_units: s.completed_units_count
    })), null, 2));

    fs.writeFileSync('user_sections.json', JSON.stringify(sections, null, 2));
  } else {
    console.error(`Fetch sections failed: ${sectionsRes.status}`);
  }
}

loginAndSetup();
