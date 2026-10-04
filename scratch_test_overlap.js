import "dotenv/config";

function getBestOptionByOverlap(q) {
  const opts = [q.amcq?.option1, q.amcq?.option2, q.amcq?.option3, q.amcq?.option4];
  const exp = (q.explanation || "").toLowerCase();
  
  // 1. Direct lowercase substring
  for (let i = 0; i < opts.length; i++) {
    if (opts[i] && exp.includes(opts[i].toLowerCase())) {
      return { pick: i + 1, reason: `Direct substring: "${opts[i]}"` };
    }
  }

  // 2. Word / stem overlap
  let bestScore = -1;
  let bestIdx = 0;
  const expWords = exp.split(/[^a-z0-9]+/).filter(w => w.length > 2);

  opts.forEach((opt, idx) => {
    if (!opt) return;
    const optWords = opt.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
    let matches = 0;
    optWords.forEach(w => {
      // Check if word or stem (e.g. finish/finished) is in expWords
      const stem = w.slice(0, 4);
      if (expWords.some(ew => ew.includes(stem) || stem.includes(ew.slice(0, 4)))) {
        matches++;
      }
    });
    const score = optWords.length > 0 ? matches / optWords.length : 0;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  if (bestScore > 0.4) {
    return { pick: bestIdx + 1, reason: `Word overlap (${Math.round(bestScore * 100)}%): "${opts[bestIdx]}"` };
  }

  return { pick: 1, reason: "Default 1" };
}

async function test() {
  const examId = "673388000";
  const qUrl = `https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-exams/${examId}/questions`;
  const qRes = await fetch(qUrl, { headers: { Authorization: process.env.TOKEN } });
  const qData = await qRes.json();
  const questions = (qData.test_definition_section || []).flatMap(s => s.questions || []);

  for (const q of questions) {
    console.log(`\n--- Q ${q.id} : ${q.question} ---`);
    console.log(`Explanation: ${q.explanation}`);
    const res = getBestOptionByOverlap(q);
    console.log(`Result: Option ${res.pick} -> ${res.reason}`);
  }
}

test().catch(console.error);
