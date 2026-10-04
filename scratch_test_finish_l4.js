import "dotenv/config";

async function test() {
  const examId = "673565250";
  const lessonInstId = "6805526";

  const qUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers: { Authorization: process.env.TOKEN } });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);
  console.log("Exam questions count:", questions.length);

  // Submit Q10
  const q10 = questions[9];
  console.log("Q10:", q10.id, q10.question);
  const ansUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-exams/${examId}/answers`;
  const ansRes = await fetch(ansUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: process.env.TOKEN },
    body: JSON.stringify({
      type: q10.type,
      question_uuid: q10.uuid,
      amcq_selected_answer: 1,
    }),
  });
  console.log("Q10 submit status:", ansRes.status, await ansRes.json());

  // Submit Exam
  const subUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-section-unit-lesson-insts/${lessonInstId}/bet-exams/${examId}:submit`;
  const subRes = await fetch(subUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: process.env.TOKEN },
    body: JSON.stringify({}),
  });
  console.log("Exam submit status:", subRes.status, await subRes.text());
}

test();
