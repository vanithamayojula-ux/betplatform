import "dotenv/config";
import fs from "fs";
import os from "os";
import path from "path";
import https from "https";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12520776",
  userEmail: "12520776@lpu.in",
  userPass: "12520776",
  authToken: process.env.TOKEN,
  groqKey: process.env.GROQ_KEY || process.env.groq_key,
  groqModel: "openai/gpt-oss-20b",
};

const TRACK_UNITS = [
  { sectionName: "Listening", betSectionInstId: "176874", units: [{ id: 941823, name: "Topic 1" }, { id: 941828, name: "Topic 2" }] },
  { sectionName: "Reading", betSectionInstId: "176800", units: [{ id: 941841, name: "Topic 1" }, { id: 941844, name: "Topic 2" }] },
  { sectionName: "Writing", betSectionInstId: "176869", units: [{ id: 941805, name: "Topic 1" }, { id: 941820, name: "Topic 2" }] },
  { sectionName: "Speaking", betSectionInstId: "176843", units: [{ id: 941831, name: "Topic 1" }, { id: 941832, name: "Topic 2" }] },
];

const headers = { "Content-Type": "application/json" };
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function log(...args) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
  process.stdout.write(line);
  fs.appendFileSync("audit_85_progress.txt", line);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loginIfNeeded() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      const rawToken = data.jwtToken || data.token || data.id_token;
      if (rawToken) {
        const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
        CONFIG.authToken = token;
        headers["Authorization"] = token;
        return token;
      }
    }
  } catch (e) {}
}

async function getLessonInsts(betSectionInstId, unitId) {
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${betSectionInstId}/bet-section-unit-insts/${unitId}/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers, method: "GET", signal: AbortSignal.timeout(12000) });
  if (res.status === 401) await loginIfNeeded();
  if (!res.ok) throw new Error(`GET lesson-insts failed ${res.status}`);
  return res.json();
}

async function main() {
  fs.writeFileSync("audit_85_progress.txt", "=== AUDITING 120 LESSONS FOR <85% SCORES ===\n");
  log("Scanning 120 lessons across 4 tracks (Topic 1 & Topic 2)...");

  const lowScoreLessons = [];

  for (const track of TRACK_UNITS) {
    log(`\n--- ${track.sectionName} ---`);
    for (const unit of track.units) {
      try {
        const lessons = await getLessonInsts(track.betSectionInstId, unit.id);
        for (const l of lessons) {
          const inst = (l.section_unit_lesson_insts || [])[0];
          const pct = inst?.percentage != null ? Number(inst.percentage) : null;
          const status = inst?.bet_status || l.lesson_status;
          log(`  [${track.sectionName} ${unit.name}] L${l.seq_no} "${l.lesson_name}" => pct: ${pct != null ? pct + "%" : "null"}, status: ${status}`);
          
          if (pct == null || pct < 85) {
            lowScoreLessons.push({
              track: track.sectionName,
              betSectionInstId: track.betSectionInstId,
              unitId: unit.id,
              unitName: unit.name,
              seqNo: l.seq_no,
              lessonName: l.lesson_name,
              lessonInstId: inst?.lesson_inst_id,
              currentPct: pct,
              currentStatus: status
            });
          }
        }
      } catch (e) {
        log(` !! Error fetching unit ${unit.id}: ${e.message}`);
      }
    }
  }

  log(`\n======================================================`);
  log(`Found ${lowScoreLessons.length} / 120 lessons with score < 85% or missing score.`);
  log(`======================================================`);
  fs.writeFileSync("low_scores.json", JSON.stringify(lowScoreLessons, null, 2));
}

main().catch(console.error);
