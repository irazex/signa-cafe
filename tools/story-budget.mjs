// Reserve a conservative upper bound before creating a paid response. All UTF-8
// input bytes count as tokens here (overestimates), plus schema/protocol overhead.
export function requestCeiling({ messages, jsonSchema, maxTokens, model, rates }) {
  const rate = rates.models?.[model];
  if (!rate || !Number.isFinite(rate.input) || !Number.isFinite(rate.output) || rate.input < 0 || rate.output < 0) {
    throw new Error(`no verified price for ${model}; paid request blocked`);
  }
  const inputBound = Buffer.byteLength(JSON.stringify({ messages, jsonSchema }), "utf8") + 4096;
  if (!Number.isInteger(maxTokens) || maxTokens <= 0 || inputBound > 272000) {
    throw new Error("request exceeds verified standard-context price bounds; paid request blocked");
  }
  return (inputBound * rate.input + maxTokens * rate.output) / 1e6;
}

export function checkBudget({ ceiling, daySpent, monthSpent, runSpent, dailyCap, monthlyCap, runCap }) {
  for (const [label, spent, cap] of [
    ["daily", daySpent, dailyCap], ["monthly", monthSpent, monthlyCap], ["run", runSpent, runCap],
  ]) {
    if (![cap, spent, ceiling].every(Number.isFinite) || cap <= 0 || spent < 0 || ceiling < 0) {
      throw new Error(`invalid ${label} budget; paid request blocked`);
    }
    if (spent + ceiling > cap) {
      throw new Error(`${label} budget: $${spent.toFixed(2)} spent, next request reserves up to $${ceiling.toFixed(2)}, cap $${cap.toFixed(2)}; paid request blocked`);
    }
  }
}
