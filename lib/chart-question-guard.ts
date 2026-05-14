export const MIN_CLIENT_QUESTION_CHARS = 8;
export const MAX_CLIENT_QUESTION_CHARS = 320;

const PROMPT_INJECTION_PATTERNS = [
  /\b(ignore|forget|override|disregard)\s+(all\s+)?(previous|prior|above|system|developer|these)\s+instructions\b/i,
  /\b(system|developer|hidden)\s+(prompt|message|instruction|instructions)\b/i,
  /\b(reveal|show|print|leak|expose|return)\b[\s\S]{0,80}\b(prompt|instructions|api key|secret|token|password|environment|env)\b/i,
  /\b(jailbreak|dan mode|do anything now|prompt injection)\b/i,
  /\bact as\b[\s\S]{0,80}\b(system|developer|admin|root)\b/i,
  /<\s*script\b/i,
  /```/,
  /\b(curl|powershell|cmd\.exe|bash)\s+/i,
  /\b(write|generate|create)\b[\s\S]{0,80}\b(code|script|malware|exploit|phishing)\b/i,
  /https?:\/\//i,
];

export function normalizeClientQuestion(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function getClientQuestionValidationError(question: unknown) {
  if (typeof question !== "string") {
    return "Question must be text.";
  }

  const normalized = normalizeClientQuestion(question);

  if (normalized.length < MIN_CLIENT_QUESTION_CHARS) {
    return "Ask one specific question with a little more detail.";
  }

  if (normalized.length > MAX_CLIENT_QUESTION_CHARS) {
    return `Question must be ${MAX_CLIENT_QUESTION_CHARS} characters or fewer.`;
  }

  if (/[\r\n]/.test(question)) {
    return "Ask one focused question instead of a list.";
  }

  const longSentenceCount = normalized
    .split(/[.!?]+/)
    .filter((sentence) => sentence.trim().length > 18).length;

  if (longSentenceCount > 2 || (normalized.match(/\?/g) ?? []).length > 2) {
    return "Ask one focused question instead of multiple questions.";
  }

  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "That question cannot be processed. Please ask about the chart itself.";
  }

  return null;
}
