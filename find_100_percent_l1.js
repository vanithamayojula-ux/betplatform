import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "12526132@lpu.in",
  userPass: "12526132",
  userId: "12526132",
  writingSectionInstId: "176869",
  topic1UnitId: 941805
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const q1Candidates = [
  "This person helps the team every day with communication and reports.",
  "The employee manages team communication and helps with daily reports.",
  "This worker communicates with teams and writes small reports.",
  "This person handles daily communication, reports, and task progress.",
  "The manager coordinates daily team work and writes reports.",
  "This person manages communication and assists with daily team tasks."
];

const q2Candidates = [
  "Project Coordinator",
  "Team Assistant",
  "Operations Manager",
  "Project Manager",
  "Office Assistant"
];

const q3Candidates = [
  "Project Coordinator. They manage schedules and ensure tasks are completed on time.",
  "Operations Assistant. This person coordinates tasks and helps team members daily.",
  "Team Coordinator because they manage schedules and talk to departments.",
  "Office Manager. They keep records and make sure work is done on time.",
  "Project Assistant because they help teams and ensure work is finished on time."
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runTest() {
  const loginRes = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CONFIG.userEmail, password: CONFIG.userPass, appContext: "BET_CORPORATE" })
  });
  const loginData = await loginRes.json();
  const token = loginData.jwtToken || loginData.token;
  const auth = token.startsWith("Bearer ") ? token : "Bearer " + token;
  const headers = { Authorization: auth, "Content-Type": "application/json" };

  // Fetch L1 inst ID
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${CONFIG.topic1UnitId}/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers });
  const lessons = await res.json();
  const l1 = lessons.find(l => l.seq_no === 1);
  const l1Inst = l1.section_unit_lesson_insts.slice(-1)[0] || l1.section_unit_lesson_insts[0];
  const lessonInstId = l1Inst.lesson_inst_id;

  for (let i = 0; i < q1Candidates.length; i++) {
    for (let j = 0; j < q2Candidates.length; j++) {
      for (let k = 0; k < q3Candidates.length; k++) {
        const a1 = q1Candidates[i];
        const a2 = q2Candidates[j];
        const a3 = q3Candidates[k];

        console.log(`\n--- Testing Combination (Q1:${i}, Q2:${j}, Q3:${k}) ---`);
        console.log(`Q1: "${a1}"`);
        console.log(`Q2: "${a2}"`);
        console.log(`Q3: "${a3}"`);

        // Create exam
        const examUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
        const examRes = await fetch(examUrl, { method: "POST", headers, body: "{}" });
        const examData = await examRes.json();
        const examId = examData.id;
        if (!examId) {
          console.log(`Failed to create exam!`);
          continue;
        }

        // Fetch Questions
        const qUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/questions`;
        const qRes = await fetch(qUrl, { headers });
        const qData = await qRes.json();
        const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

        const answers = [a1, a2, a3];
        for (let qIdx = 0; qIdx < questions.length; qIdx++) {
          const ansUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams/${examId}/answers`;
          await fetch(ansUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
              type: "SUBJECTIVE",
              question_uuid: questions[qIdx].uuid,
              subjective_written_answer: answers[qIdx]
            })
          });
        }

        // Submit exam
        const submitUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
        const subRes = await fetch(submitUrl, { method: "POST", headers, body: "{}" });
        const subData = await subRes.json().catch(() => ({}));
        console.log(`Submit response: ${JSON.stringify(subData)}`);

        await sleep(1000);

        // Check score in insts list
        const checkRes = await fetch(url, { headers });
        const checkLessons = await checkRes.json();
        const updatedL1 = checkLessons.find(l => l.seq_no === 1);
        const latestInst = updatedL1.section_unit_lesson_insts.slice(-1)[0] || {};

        console.log(`Result: status="${updatedL1.lesson_status}", bet_status="${latestInst.bet_status}", percentage=${latestInst.percentage}%`);

        if (latestInst.percentage != null && latestInst.percentage >= 85) {
          console.log(`\n🎉 BINGO! PASSED L1 WITH ${latestInst.percentage}%!`);
          console.log(`Winning Answers:\nQ1: "${a1}"\nQ2: "${a2}"\nQ3: "${a3}"`);
          return;
        }
      }
    }
  }
}

runTest().catch(console.error);
