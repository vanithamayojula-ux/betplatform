import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();

async function fastScan() {
  console.log("Fast scanning section IDs 170000..190000...");
  const hits = [];

  const batchSize = 200;
  for (let start = 170000; start < 190000; start += batchSize) {
    const promises = [];
    for (let id = start; id < start + batchSize; id++) {
      const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12519446/bet-section-insts/${id}/bet-section-unit-insts`;
      promises.push(
        fetch(url, { headers: { authorization: token } }).then(async r => {
          if (r.ok) {
            const data = await r.json();
            if (Array.isArray(data) && data.length > 0) {
              const secName = data[0].section_name;
              console.log(`FOUND! SectionId: ${id}, Name: ${secName}, Units: ${data.length}`);
              hits.push({ id, sectionName: secName, unitsCount: data.length });
            }
          }
        }).catch(() => {})
      );
    }
    await Promise.all(promises);
  }

  fs.writeFileSync('found_sections_12519446.json', JSON.stringify(hits, null, 2));
  console.log(`Scan COMPLETE! Found ${hits.length} sections:`, hits);
}

fastScan();
