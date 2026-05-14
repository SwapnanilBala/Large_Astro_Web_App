import Anthropic from "@anthropic-ai/sdk";

let claudeClient: Anthropic | null = null;

export function getClaudeClient() {
  const apiKey =
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.CLAUDE_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  if (!claudeClient) {
    claudeClient = new Anthropic({ apiKey });
  }

  return claudeClient;
}

export function getClaudeModel() {
  return process.env.CLAUDE_MODEL?.trim() || "claude-3-5-sonnet-latest";
}
