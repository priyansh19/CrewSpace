import { agentsApi } from "../api/agents";
import type { Agent } from "@paperclipai/shared";
import type { ChatMessage } from "../context/ChatContext";

export const AGENT_STATUS_COLOR: Record<string, string> = {
  running: "#22d3ee",
  active: "#4ade80",
  paused: "#facc15",
  idle: "#facc15",
  error: "#f87171",
  terminated: "#a3a3a3",
};

export function agentDotColor(status: string): string {
  return AGENT_STATUS_COLOR[status] ?? "#a3a3a3";
}

export function formatChatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export async function streamAgentChat(
  agent: Agent,
  history: ChatMessage[],
  companyId: string | undefined,
  signal: AbortSignal,
  onChunk: (partial: string) => void,
): Promise<string> {
  const messages = history.map((m) => ({
    role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
    content: m.content,
  }));
  let full = "";
  try {
    for await (const chunk of agentsApi.chatStream(agent.id, messages, companyId, signal)) {
      full += chunk;
      onChunk(full);
    }
  } catch (err: unknown) {
    if ((err as Error).name === "AbortError") return full;
    const msg = err instanceof Error ? err.message : String(err);
    return full || `I couldn't be reached right now (${msg}).`;
  }
  return full || "I didn't produce a response. Please try again.";
}
