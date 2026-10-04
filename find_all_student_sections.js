import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();

async function mapSections() {
  const unitsMap = {
    Listening: 941823,
    Speaking: 941831,
    Writing: 941805,
    Reading: 941801
  };

  const results = {};

  for (const [name, unitId] of Object.entries(unitsMap)) {
    for (let secId = 177000; secId < 177100; secId++) {
      const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12519446/bet-section-insts/${secId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`;
      try {
        const r = await fetch(url, { headers: { authorization: token } });
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data) && data.length > 0) {
            results[name] = { betSectionInstId: String(secId), lessonCount: data.length };
            break;
          }
        }
      } catch {}
    }
  }

  fs.writeFileSync('all_sections_12519446.json', JSON.stringify(results, null, 2));
  console.log("Full section map:", results);
}

mapSections();
