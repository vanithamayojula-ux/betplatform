import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();
const orgSlug = "lpu724598";
const userId = "12519446";

async function discover() {
  const routes = [
    `/api/orgs/${orgSlug}/users/${userId}/bet-section-insts`,
    `/api/orgs/${orgSlug}/users/${userId}/bet-section-unit-insts`,
    `/api/orgs/${orgSlug}/users/${userId}/bet-courses`,
    `/api/orgs/${orgSlug}/users/${userId}/dashboard`,
    `/api/orgs/${orgSlug}/users/${userId}/sections`,
    `/api/orgs/${orgSlug}/users/${userId}/profile`,
    `/api/orgs/${orgSlug}/bet-section-insts?user_id=${userId}`,
    `/api/orgs/${orgSlug}/bet-sections`,
    `/api/orgs/${orgSlug}/bet-courses`,
    `/api/public/bet-exams/sections`
  ];

  let out = "";
  for (const r of routes) {
    const url = `https://corporate.bharatenglish.org${r}`;
    try {
      const res = await fetch(url, { headers: { authorization: token } });
      out += `${res.status} -> ${url}\n`;
      if (res.ok) {
        const txt = await res.text();
        out += `  BODY: ${txt.slice(0, 300)}\n\n`;
      }
    } catch (e) {
      out += `  ERR: ${e.message}\n`;
    }
  }

  fs.writeFileSync('api_discovery.txt', out);
  console.log("Discovery finished! Check api_discovery.txt");
}

discover();
