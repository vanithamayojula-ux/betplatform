import "dotenv/config";

async function test() {
  const examId = "673582350";
  const qUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers: { Authorization: process.env.TOKEN } });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

  const q5 = questions[4];
  console.log("Q5:", q5.id, q5.question);
  console.log("Q5 Exp:", q5.explanation);
  console.log("Q5 Opts:", [q5.amcq?.option1, q5.amcq?.option2, q5.amcq?.option3, q5.amcq?.option4]);

  // Submit Q5
  const ansUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-exams/${examId}/answers`;
  const ansRes = await fetch(ansUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: process.env.TOKEN },
    body: JSON.stringify({
      type: q5.type,
      question_uuid: q5.uuid,
      amcq_selected_answer: 2,
    }),
  });
  console.log("Ans status:", ansRes.status, await ansRes.json());

  // Submit Exam
  const subUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-section-unit-lesson-insts/6805527/bet-exams/${examId}:submit`;
  const subRes = await fetch(subUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: process.env.TOKEN },
    body: JSON.stringify({}),
  });
  console.log("Submit status:", subRes.status, await subRes.text());
}

test();
