import "dotenv/config";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const headers = {
    "Content-Type": "application/json",
    Authorization: process.env.TOKEN,
  };

  // Create an exam for L2
  const cr = await fetch("https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12518334/bet-section-unit-lesson-insts/7981009/bet-exams", { method: "POST", headers, body: "{}" });
  const { id: examId } = await cr.json();

  const answers = [
    { uuid: "9a8646a0-f634-4440-afd7-25b12264632b", ans: "Meeting Tomorrow" },
    { uuid: "f220433e-b3e9-4a61-87b9-b9a6e239cfed", ans: "Monthly Report Submission" },
    { uuid: "81256c9b-9ad5-4848-a53a-5aa76e881b6b", ans: "Urgent: Immediate Action Required on Critical System Update Today" }
  ];

  for (const a of answers) {
    await fetch(`https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12518334/bet-exams/${examId}/answers`, {
      method: "POST", headers, body: JSON.stringify({ type: "SUBJECTIVE", question_uuid: a.uuid, subjective_written_answer: a.ans })
    });
    const res = await fetch(`https://corporate.bharatenglish.org/api/orgs/lpu724598/bet-exams/${examId}/writing-evaluation?question_uuid=${a.uuid}`, { method: "POST", headers, body: "{}" });
    console.log(a.uuid, "Eval status:", res.status);
    let d = await res.json().catch(() => ({}));
    if (res.status === 202) {
      await new Promise(r => setTimeout(r, 4000));
      const res2 = await fetch(`https://corporate.bharatenglish.org/api/orgs/lpu724598/bet-exams/${examId}/writing-evaluation?question_uuid=${a.uuid}`, { method: "POST", headers, body: "{}" });
      d = await res2.json().catch(() => ({}));
    }
    console.log("Evaluation details for:", a.ans);
    console.log(JSON.stringify(d, null, 2));
  }
}

main().catch(console.error);
