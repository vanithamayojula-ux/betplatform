import "dotenv/config";

async function test() {
  const examId = "673438450";
  const qUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers: { Authorization: process.env.TOKEN } });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

  for (const q of questions) {
    console.log(`\n--- Q ${q.id} uuid=${q.uuid} ---`);
    console.log("Question:", q.question);
    console.log("Explanation:", q.explanation);
    console.log("Options:", [q.amcq?.option1, q.amcq?.option2, q.amcq?.option3, q.amcq?.option4]);
  }
}

test();
