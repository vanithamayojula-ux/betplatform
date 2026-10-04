function getBestOption(q) {
  const opts = [q.amcq?.option1, q.amcq?.option2, q.amcq?.option3, q.amcq?.option4];
  const exp = (q.explanation || "").toLowerCase();

  // 1. Direct substring in either direction
  for (let i = 0; i < opts.length; i++) {
    if (!opts[i]) continue;
    const o = opts[i].toLowerCase().trim();
    if (exp.includes(o)) return { pick: i + 1, reason: `exp includes "${o}"` };
  }

  // 2. Time match (e.g. 10:30, 12:15, 3:15, 11:15)
  for (let i = 0; i < opts.length; i++) {
    if (!opts[i]) continue;
    const timeMatch = opts[i].match(/\d{1,2}:\d{2}/);
    if (timeMatch && exp.includes(timeMatch[0])) {
      return { pick: i + 1, reason: `time match "${timeMatch[0]}"` };
    }
  }

  // 3. Number match (e.g. 9, 10, 11)
  for (let i = 0; i < opts.length; i++) {
    if (!opts[i]) continue;
    const numMatch = opts[i].match(/\b\d+\b/);
    if (numMatch && exp.includes(numMatch[0])) {
      return { pick: i + 1, reason: `num match "${numMatch[0]}"` };
    }
  }

  // 4. Word / stem overlap
  let bestScore = -1;
  let bestIdx = 0;
  const expWords = exp.split(/[^a-z0-9]+/).filter((w) => w.length > 2);

  opts.forEach((opt, idx) => {
    if (!opt) return;
    const optWords = opt.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && w !== "the" && w !== "and");
    if (optWords.length === 0) return;
    let matches = 0;
    optWords.forEach((w) => {
      const stem = w.slice(0, 4);
      if (expWords.some((ew) => ew.includes(stem) || stem.includes(ew.slice(0, 4)))) {
        matches++;
      }
    });
    const score = matches / optWords.length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  return { pick: bestIdx + 1, reason: `word overlap (${Math.round(bestScore * 100)}%)` };
}

const testQuestions = [
  {
    question: "What time do they usually have a coffee break?",
    explanation: "Tom mentions that they usually have a coffee break around 10:30.",
    amcq: { option1: '9:00 AM', option2: '10:30 AM', option3: '12:00 PM', option4: '2:00 PM' }
  },
  {
    question: "What time is Sarah going to the cafeteria?",
    explanation: "Sarah clearly states she will be at the cafeteria at 12:15.",
    amcq: { option1: '12:00 PM', option2: '12:15 PM', option3: '12:30 PM', option4: '1:00 PM' }
  },
  {
    question: "What time should the new employee return from their break?",
    explanation: "The manager specifies that the employee should be back by 11:15.",
    amcq: { option1: '11:00', option2: '11:10', option3: '11:15', option4: '11:30' }
  },
  {
    question: "What time does the meeting start?",
    explanation: "Bob mentions that the meeting starts at 3:00 PM.",
    amcq: { option1: '2:00 PM', option2: '2:30 PM', option3: '3:00 PM', option4: '3:30 PM' }
  },
  {
    question: "What time do they plan to go to the conference room?",
    explanation: "Liam suggests going to the conference room at 3:15.",
    amcq: { option1: '3:00 PM', option2: '3:15 PM', option3: '3:30 PM', option4: '4:00 PM' }
  }
];

testQuestions.forEach((q, i) => {
  const res = getBestOption(q);
  console.log(`Q${i + 1}: Pick=${res.pick} (${q.amcq['option' + res.pick]}) -> ${res.reason}`);
});
