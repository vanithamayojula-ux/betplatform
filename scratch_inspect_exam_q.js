import "dotenv/config";

async function test() {
  const examId = "673443950";
  const qUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers: { Authorization: process.env.TOKEN } });
  console.log("Status:", qRes.status);
  const qData = await qRes.json();
  console.log("Data keys:", Object.keys(qData));
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);
  console.log("Questions length:", questions.length);
  if (questions.length > 0) {
    console.log("Sample question:", questions[0]);
  } else {
    console.log("Full data:", JSON.stringify(qData, null, 2));
  }
}

test();
