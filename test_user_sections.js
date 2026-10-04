import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();

async function run() {
  const sectionsToTest = [177434, 177430, 177439, 177435, 177436, 177437, 177438, 177440];
  let out = "";
  for (const sid of sectionsToTest) {
    const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12519446/bet-section-insts/${sid}/bet-section-unit-insts`;
    const r = await fetch(url, { headers: { authorization: token } });
    out += `SectionInstId ${sid}: Status ${r.status}\n`;
    if (r.ok) {
      const data = await r.json();
      out += `Found ${data.length} units!\n`;
      fs.writeFileSync(`section_${sid}_units.json`, JSON.stringify(data, null, 2));
    }
  }
  fs.writeFileSync('test_sections_out.txt', out);
}

run();
