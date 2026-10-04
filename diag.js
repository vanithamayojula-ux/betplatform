import "dotenv/config";
import fs from "fs";

const baseUrl = "https://corporate.bharatenglish.org";
const orgSlug = "lpu724598";
const userId = "12520776";
const headers = {
  "Content-Type": "application/json",
  "Authorization": process.env.TOKEN
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function run() {
  const url = `${baseUrl}/api/orgs/${orgSlug}/users/${userId}/bet-section-insts`;
  const res = await fetch(url, { headers });
  const rawData = await res.json();
  console.log("Raw response keys/type:", typeof rawData, Array.isArray(rawData) ? "array" : Object.keys(rawData));
  const sections = Array.isArray(rawData) ? rawData : (rawData.bet_section_insts || rawData.sections || rawData.data || []);
  console.log("Sections count:", sections.length);
  
  const result = [];
  for (const sec of sections) {
    const secId = sec.section_inst_id || sec.id;
    const secName = sec.section_name || sec.title || sec.name;
    console.log(`Checking Section ${secId} (${secName})...`);
    
    const uUrl = `${baseUrl}/api/orgs/${orgSlug}/users/${userId}/bet-section-insts/${secId}/bet-section-unit-insts`;
    const uRes = await fetch(uUrl, { headers });
    let rawUnits = [];
    if (uRes.ok) {
      rawUnits = await uRes.json();
    }
    const units = Array.isArray(rawUnits) ? rawUnits : (rawUnits.bet_section_unit_insts || rawUnits.units || rawUnits.data || []);
    
    const unitDetails = [];
    for (const u of units) {
      const uId = u.section_unit_inst_id || u.id;
      const lUrl = `${baseUrl}/api/orgs/${orgSlug}/users/${userId}/bet-section-insts/${secId}/bet-section-unit-insts/${uId}/bet-section-unit-lesson-insts`;
      const lRes = await fetch(lUrl, { headers });
      let rawLessons = [];
      if (lRes.ok) {
        rawLessons = await lRes.json();
      }
      const lessons = Array.isArray(rawLessons) ? rawLessons : (rawLessons.bet_section_unit_lesson_insts || rawLessons.lessons || rawLessons.data || []);
      
      unitDetails.push({
        unit_inst_id: uId,
        unit_name: u.unit_name || u.name,
        unit_status: u.unit_status || u.status,
        percentage: u.percentage,
        lesson_count: lessons.length,
        lessons: lessons.map(l => {
          const inst = (l.section_unit_lesson_insts || [])[0];
          return {
            seq_no: l.seq_no,
            lesson_name: l.lesson_name,
            lesson_status: l.lesson_status,
            bet_status: inst?.bet_status,
            percentage: inst?.percentage,
            exam_id: inst?.exam_id,
            lesson_inst_id: inst?.lesson_inst_id
          };
        })
      });
    }
    
    result.push({
      section_inst_id: secId,
      section_name: secName,
      section_status: sec.section_status || sec.status,
      percentage: sec.percentage,
      units: unitDetails
    });
  }
  
  fs.writeFileSync("user_dashboard_status.json", JSON.stringify(result, null, 2));
  console.log("Saved dashboard status to user_dashboard_status.json");
}

run().catch(console.error);
