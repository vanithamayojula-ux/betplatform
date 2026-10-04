import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12505970@lpu.in",
  userPassCombo: [
    { username: "12505970@lpu.in", password: "12505970@lpu.in" },
    { username: "12505970@lpu.in", password: "12505970" },
    { username: "12505970", password: "12505970@lpu.in" },
    { username: "12505970", password: "12505970" }
  ],
  userId: "12505970",
  speakingSectionInstId: "176843",
  targetUnits: [
    { uId: 941831, name: "Topic 1 (Introducing Yourself)" },
    { uId: 941832, name: "Topic 2 (Talking About Daily Tasks)" }
  ]
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function login() {
  for (const c of CONFIG.userPassCombo) {
    try {
      const res = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: c.username, password: c.password, appContext: "BET_CORPORATE" })
      });
      if (res.ok) {
        const d = await res.json();
        const raw = d.jwtToken || d.token || d.id_token;
        if (raw) return raw.startsWith("Bearer ") ? raw : "Bearer " + raw;
      }
    } catch (e) {}
  }
}

async function dump() {
  const auth = await login();
  const headers = { Authorization: auth, "Content-Type": "application/json" };

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.speakingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    const lessons = await res.json();
    const lessonArr = Array.isArray(lessons) ? lessons : (lessons.content || []);

    console.log(`\n=================== ${u.name} ===================`);
    for (const l of lessonArr) {
      const insts = l.section_unit_lesson_insts || [];
      const inst = insts.slice(-1)[0] || insts[0] || {};
      const status = l.lesson_status || inst.bet_status;
      const count = l.completed_lessons_count || 0;
      const pct = inst.percentage;
      console.log(`L${l.seq_no} (${l.lesson_name}): status="${status}", count=${count}, pct=${pct}%, instId=${inst.lesson_inst_id}`);
    }
  }
}

dump().catch(console.error);
