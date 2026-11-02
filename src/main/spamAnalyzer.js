const SPAM_RULES = [
  {
    phrase: "100% free",
    pattern: /\b100\s*%\s*free\b/i,
    suggestion: "complimentary"
  },
  {
    phrase: "100% guaranteed",
    pattern: /\b100\s*%\s*guaranteed\b/i,
    suggestion: "designed to"
  },
  {
    phrase: "guaranteed",
    pattern: /\bguaranteed\b/i,
    suggestion: "expected"
  },
  {
    phrase: "risk free",
    pattern: /\brisk[-\s]?free\b/i,
    suggestion: "low-risk"
  },
  {
    phrase: "no risk",
    pattern: /\bno\s+risk\b/i,
    suggestion: "low-risk"
  },
  {
    phrase: "act now",
    pattern: /\bact\s+now\b/i,
    suggestion: "when convenient"
  },
  {
    phrase: "buy now",
    pattern: /\bbuy\s+now\b/i,
    suggestion: "learn more"
  },
  {
    phrase: "click here",
    pattern: /\bclick\s+here\b/i,
    suggestion: "view the details"
  },
  {
    phrase: "limited time",
    pattern: /\blimited\s+time\b/i,
    suggestion: "available currently"
  },
  {
    phrase: "urgent",
    pattern: /\burgent\b/i,
    suggestion: "important"
  },
  {
    phrase: "winner",
    pattern: /\bwinner\b/i,
    suggestion: "selected contact"
  },
  {
    phrase: "congratulations",
    pattern: /\bcongratulations\b/i,
    suggestion: "thank you"
  },
  {
    phrase: "free",
    pattern: /\bfree\b/i,
    suggestion: "included"
  },
  {
    phrase: "cash",
    pattern: /\bcash\b/i,
    suggestion: "budget"
  },
  {
    phrase: "money back",
    pattern: /\bmoney\s+back\b/i,
    suggestion: "refund policy"
  },
  {
    phrase: "double your",
    pattern: /\bdouble\s+your\b/i,
    suggestion: "improve your"
  },
  {
    phrase: "earn money",
    pattern: /\bearn\s+money\b/i,
    suggestion: "generate revenue"
  },
  {
    phrase: "make money",
    pattern: /\bmake\s+money\b/i,
    suggestion: "increase revenue"
  },
  {
    phrase: "million",
    pattern: /\bmillion\b/i,
    suggestion: "significant"
  },
  {
    phrase: "profit",
    pattern: /\bprofit\b/i,
    suggestion: "commercial return"
  },
  {
    phrase: "growth",
    pattern: /\bgrowth\b/i,
    suggestion: "development"
  },
  {
    phrase: "deal",
    pattern: /\bdeal\b/i,
    suggestion: "proposal"
  },
  {
    phrase: "special offer",
    pattern: /\bspecial\s+offer\b/i,
    suggestion: "proposal"
  },
  {
    phrase: "exclusive offer",
    pattern: /\bexclusive\s+offer\b/i,
    suggestion: "proposal"
  },
  {
    phrase: "discount",
    pattern: /\bdiscount\b/i,
    suggestion: "preferred pricing"
  },
  {
    phrase: "subscribe",
    pattern: /\bsubscribe\b/i,
    suggestion: "learn more"
  },
  {
    phrase: "unsubscribe",
    pattern: /\bunsubscribe\b/i,
    suggestion: "manage preferences"
  }
];

function analyzeSpam(subject = "", body = "") {
  const combinedText = `${subject}\n${body}`.trim();

  const flags = [];

  for (const rule of SPAM_RULES) {
    if (rule.pattern.test(combinedText)) {
      flags.push({
        word: rule.phrase,
        suggestion: rule.suggestion
      });
    }
  }

  const exclamationCount = (
    combinedText.match(/!/g) || []
  ).length;

  const uppercaseLetters = (
    combinedText.match(/[A-Z]/g) || []
  ).length;

  const letters = (
    combinedText.match(/[A-Za-z]/g) || []
  ).length;

  let penalty = flags.length * 5;

  if (exclamationCount >= 3) {
    penalty += 5;
  }

  if (
    letters >= 30 &&
    uppercaseLetters / letters > 0.55
  ) {
    penalty += 10;
  }

  if (subject.length > 100) {
    penalty += 5;
  }

  if (body.length < 20 && body.length > 0) {
    penalty += 5;
  }

  const score = Math.max(
    0,
    Math.min(100, 100 - penalty)
  );

  let label = "100% SPAM SAFE";

  if (score < 100 && score >= 90) {
    label = `${score}% SPAM SAFE`;
  } else if (score >= 75) {
    label = `${score}% LOW RISK`;
  } else if (score >= 50) {
    label = `${score}% REVIEW`;
  } else {
    label = `${score}% HIGH RISK`;
  }

  return {
    score,
    label,
    flaggedWords: flags,
    metrics: {
      triggerCount: flags.length,
      exclamationCount,
      uppercaseRatio:
        letters === 0
          ? 0
          : Number(
              (uppercaseLetters / letters).toFixed(3)
            ),
      subjectLength: subject.length,
      bodyLength: body.length
    }
  };
}

module.exports = {
  analyzeSpam
};