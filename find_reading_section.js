import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();

async function findReadingSection() {
  console.log("Searching for TRUE Reading section ID for student 12520776...");
  
  // Reading unit IDs are typically 941841, 941844, 941842, 941843, 941845, 941846
  const readingUnitId = 941841;

  for (let secId = 176800; secId < 176950; secId++) {
    const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12520776/bet-section-insts/${secId}/bet-section-unit-insts/${readingUnitId}/bet-section-unit-lesson-insts`;
    try {
      const r = await fetch(url, { headers: { authorization: token } });
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d) && d.length > 0) {
          const secName = d[0].section_name;
          console.log(`FOUND READING SECTION INST ID: ${secId}! Section: "${secName}", Lessons: ${d.length}`);
          fs.writeFileSync('reading_sec_found.txt', String(secId));
          break;
        }
      }
    } catch {}
  }
}

findReadingSection();
