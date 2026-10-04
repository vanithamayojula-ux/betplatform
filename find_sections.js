import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();

async function findSections() {
  const userId = "12519446";
  const orgSlug = "lpu724598";

  // Try endpoints
  const endpoints = [
    `https://corporate.bharatenglish.org/api/orgs/${orgSlug}/users/${userId}/bet-section-insts`,
    `https://corporate.bharatenglish.org/api/orgs/${orgSlug}/users/${userId}/bet-course-insts`,
    `https://corporate.bharatenglish.org/api/orgs/${orgSlug}/users/${userId}/dashboard`
  ];

  for (const url of endpoints) {
    try {
      console.log(`Testing ${url}...`);
      const res = await fetch(url, { headers: { authorization: token } });
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const d = await res.json();
        fs.writeFileSync('sections_found.json', JSON.stringify(d, null, 2));
        console.log('SAVED sections_found.json');
        return;
      }
    } catch (e) {
      console.error(e.message);
    }
  }
}

findSections();
