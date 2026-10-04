import fs from 'fs';

const token = fs.readFileSync('.env', 'utf8').match(/TOKEN=(.*)/)[1].trim();

async function testExamFlow() {
  const examId = 680691800;
  const url = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12520776/bet-exams/${examId}/questions`;

  console.log(`GETting ${url}...`);
  const res = await fetch(url, {
    headers: { "Authorization": token }
  });

  console.log("Status:", res.status);
  const data = await res.json();
  const questions = (data.test_definition_section || []).flatMap(s => s.questions || []);
  console.log(`Found ${questions.length} questions for exam ${examId}`);
  fs.writeFileSync('exam_questions_dump.json', JSON.stringify(questions, null, 2));
}

testExamFlow();
