function clean(text) {
  return (text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[^a-zA-Z0-9\s:]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getBestOption(q) {
  if (q.amcq?.answer && typeof q.amcq.answer === "number") {
    return q.amcq.answer;
  }
  const rawOpts = [q.amcq?.option1, q.amcq?.option2, q.amcq?.option3, q.amcq?.option4];
  const opts = rawOpts.map(clean);
  const exp = clean(q.explanation);

  const stopWords = new Set(["a", "an", "the", "in", "on", "at", "to", "for", "of", "it", "s", "is", "its"]);
  const expWords = new Set(exp.split(/\s+/).filter(w => w.length > 0));
  let bestScore = -1;
  let bestIdx = 0;

  opts.forEach((opt, idx) => {
    if (!opt) return;
    const optWords = opt.split(/\s+/).filter(w => w.length > 0 && !stopWords.has(w));
    if (optWords.length === 0) return;
    let matchCount = 0;
    optWords.forEach(w => {
      if (expWords.has(w) || exp.includes(w)) matchCount++;
      else if (w.length > 4 && exp.includes(w.slice(0, 4))) matchCount += 0.8;
    });
    const score = matchCount / optWords.length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  return bestIdx + 1;
}

const testQuestions = [
  {
    explanation: "Sam states that his project is almost finished, indicating progress.",
    amcq: { option1: "It's just starting", option2: "It's going slowly", option3: "It's almost finished", option4: "It's not started yet" },
    expected: 3
  },
  {
    explanation: "Tom mentions that they usually have a coffee break around 10:30.",
    amcq: { option1: '9:00 AM', option2: '10:30 AM', option3: '12:00 PM', option4: '2:00 PM' },
    expected: 2
  },
  {
    explanation: "Emma clearly mentions that she started today in the finance department.",
    amcq: { option1: 'In the marketing department', option2: 'In the finance department', option3: 'In the sales department', option4: 'In the HR department' },
    expected: 2
  },
  {
    explanation: "Farewell is the formal term used for saying goodbye.",
    amcq: { option1: 'team', option2: 'pleasure', option3: 'Farewell', option4: 'Rest well' },
    expected: 3
  }
];

testQuestions.forEach((t, i) => {
  const pick = getBestOption(t);
  console.log(`Test ${i + 1}: Pick=${pick}, Expected=${t.expected}, Correct=${pick === t.expected}`);
});
