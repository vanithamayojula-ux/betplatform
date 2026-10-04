import "dotenv/config";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const headers = {
    "Content-Type": "application/json",
    Authorization: process.env.TOKEN,
  };
  const examId = 666851500;
  const uuids = [
    "365d725e-e1d2-43a7-8500-4a18b546ce83",
    "6e099489-8124-475e-bb74-9d621e2b6741",
    "db24d30f-56bb-48a1-bb92-c2ccc58ac2f8",
  ];

  for (const qUuid of uuids) {
    const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/bet-exams/${examId}/writing-evaluation?question_uuid=${qUuid}`;
    console.log(`Evaluating question ${qUuid}...`);
    for (let attempt = 1; attempt <= 10; attempt++) {
      const res = await fetch(url, { method: "POST", headers, body: "{}" });
      console.log(` -> Attempt ${attempt}: Status ${res.status}`);
      if (res.status === 200) {
        const d = await res.json();
        console.log(` -> Marks: ${d.evaluation?.marks_awarded} / ${d.evaluation?.total_marks}`);
        break;
      }
      await sleep(3000);
    }
  }

  // Now submit the exam
  const subUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12518334/bet-section-unit-lesson-insts/7994217/bet-exams/${examId}:submit`;
  console.log("Submitting exam...", subUrl);
  const subRes = await fetch(subUrl, { method: "POST", headers, body: "{}" });
  console.log("Submit status:", subRes.status);
  const subText = await subRes.text();
  console.log("Submit body:", subText);

  // Check lesson status
  const lessonsUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12518334/bet-section-insts/177439/bet-section-unit-insts/941821/bet-section-unit-lesson-insts`;
  const lRes = await fetch(lessonsUrl, { headers });
  const lData = await lRes.json();
  console.log("\nLessons status in unit 941821:");
  lData.forEach((l) =>
    console.log(
      `  L${l.seq_no} ${l.lesson_name} status=${l.lesson_status} bet=${l.section_unit_lesson_insts?.[0]?.bet_status} pct=${l.section_unit_lesson_insts?.[0]?.percentage}`
    )
  );
}

main().catch(console.error);
