import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();
const orgSlug = "lpu724598";

async function testEndpoints() {
  const ids = ["12519446", "9307590", "9309117"];
  const pathTemplates = [
    `/api/orgs/${orgSlug}/users/ID/bet-section-insts`,
    `/api/orgs/${orgSlug}/users/ID/bet-courses`,
    `/api/orgs/${orgSlug}/students/ID/bet-section-insts`,
    `/api/orgs/${orgSlug}/users/ID/dashboard`,
    `/api/orgs/${orgSlug}/users/ID/my-tests`
  ];

  for (const id of ids) {
    for (const path of pathTemplates) {
      const url = `https://corporate.bharatenglish.org${path.replace('ID', id)}`;
      try {
        const res = await fetch(url, { headers: { authorization: token } });
        console.log(`${res.status} -> ${url}`);
        if (res.ok) {
          const text = await res.text();
          fs.writeFileSync(`success_${id}_${path.split('/').pop()}.json`, text);
          console.log(`SUCCESS! Saved response for ${url}`);
        }
      } catch (e) {
        console.error(e.message);
      }
    }
  }
}

testEndpoints();
