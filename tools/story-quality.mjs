// A rejection retries only this edition and tells its writer what failed.
// Network, billing and other operational errors propagate without paid retries.
export async function validatedEdition({ label, write, check, onRetry = () => {} }) {
  let issues = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const value = await write(issues);
    issues = check(value);
    if (!issues.length) return value;
    if (attempt === 1) onRetry(issues);
  }
  throw new Error(`quality gate rejected ${label} after 2 attempts: ${issues.join("; ")}`);
}

export function qualityFeedback(issues) {
  return issues.length ? `\n\nPREVIOUS ATTEMPT WAS REJECTED. Write a complete replacement in the same schema,\nusing the same verified facts. Correct every issue below before returning:\n${issues.map((x) => `- ${x}`).join("\n")}` : "";
}

export function repeatedSentenceOpening(blocks, lang = "en") {
  // Headings and FAQ are independent text units, not neighbouring sentences.
  // A shared article ("The") is normal English; repeated two-word openings
  // such as "This dish" are a useful signal across three body sentences.
  const sentences = blocks.flatMap((b) => b.p).join(" ").split(/(?<=[.!?])\s+/);
  const heads = sentences.map((s) => {
    const words = s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    return words.slice(0, lang === "en" && /^(the|a|an)$/.test(words[0]) ? 2 : 1).join(" ");
  });
  for (let i = 2; i < heads.length; i++) {
    if (heads[i] && heads[i] === heads[i - 1] && heads[i] === heads[i - 2]) return heads[i];
  }
  return null;
}
