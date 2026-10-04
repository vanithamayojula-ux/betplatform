import "dotenv/config";

async function test() {
  const lessonInstId = "6805525";
  const createUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams`;
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: process.env.TOKEN },
    body: JSON.stringify({}),
  });
  const data = await createRes.json();
  const examId = data.id || data.exam_id || data.examId;
  console.log("Created exam:", examId);

  const qUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers: { Authorization: process.env.TOKEN } });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

  for (const q of questions) {
    console.log(`\n--- Q ${q.id} : ${q.question} ---`);
    console.log("Explanation:", q.explanation);
    console.log("Options:", [q.amcq?.option1, q.amcq?.option2, q.amcq?.option3, q.amcq?.option4]);
  }
}

test();
