import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();

async function scan() {
  console.log("Scanning section IDs for student 12519446...");
  const hits = [];

  // Search range 177000 to 179000 with concurrency
  const batchSize = 50;
  for (let start = 177000; start < 180000; start += batchSize) {
    const promises = [];
    for (let id = start; id < start + batchSize; id++) {
      const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12519446/bet-section-insts/${id}/bet-section-unit-insts`;
      promises.push(
        fetch(url, { headers: { authorization: token } }).then(async r => {
          if (r.ok) {
            const data = await r.json();
            console.log(`FOUND MATCH! SectionInstId: ${id}, Units: ${data.length}`);
            hits.push({ id, unitsCount: data.length, sampleUnit: data[0] });
          }
        }).catch(() => {})
      );
    }
    await Promise.all(promises);
    if (hits.length >= 4) break;
  }

  fs.writeFileSync('student_12519446_sections.json', JSON.stringify(hits, null, 2));
  console.log(`Scan completed! Found ${hits.length} section instances.`);
}

scan();
