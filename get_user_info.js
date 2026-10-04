import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();

async function run() {
  const ids = ["9309117", "9307590"];
  let out = "";
  for (const id of ids) {
    const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/${id}/bet-section-insts`;
    const r = await fetch(url, { headers: { authorization: token } });
    out += `=== ID: ${id} (Status: ${r.status}) ===\n`;
    if (r.ok) {
      const data = await r.json();
      out += JSON.stringify(data, null, 2) + "\n\n";
    }
  }
  fs.writeFileSync('sections_by_id.json', out);
}

run();
