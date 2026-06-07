import type { Db } from "@crewspaceai/db";
import { agentMemoriesService } from "./agentMemories.js";

export interface ChatMessage {
  role: "user" | "agent";
  content: string;
  agentId?: string;
}

/**
 * Extract a summary/learning from agent responses in a chat.
 * This creates a simple title from the agent's response (first meaningful sentence or key insight).
 */
export function extractMemorySummary(agentResponse: string): string {
  const trimmed = agentResponse.trim();

  // Split into sentences
  const sentences = trimmed
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && s.length < 200);

  if (sentences.length === 0) return trimmed.slice(0, 100);

  // Return first substantial sentence
  return sentences[0].slice(0, 120);
}

/**
 * Determine memory type based on content keywords
 */
export function classifyMemoryType(content: string): string {
  const lower = content.toLowerCase();

  if (lower.includes("decision") || lower.includes("decided") || lower.includes("choose")) {
    return "decision";
  }
  if (lower.includes("pattern") || lower.includes("usually") || lower.includes("tends")) {
    return "pattern";
  }
  if (lower.includes("insight") || lower.includes("realize") || lower.includes("understand")) {
    return "insight";
  }
  if (lower.includes("task") || lower.includes("need") || lower.includes("should")) {
    return "task";
  }
  if (lower.includes("observe") || lower.includes("notice") || lower.includes("see")) {
    return "observation";
  }
  if (lower.includes("learn") || lower.includes("found") || lower.includes("discovered")) {
    return "learning";
  }

  return "fact";
}

/**
 * Create a memory from the last agent response in a chat.
 * Returns the created memory ID.
 */
export async function createMemoryFromChat(
  db: Db,
  companyId: string,
  agentId: string,
  agentName: string,
  chatMessages: ChatMessage[],
): Promise<string | null> {
  const svc = agentMemoriesService(db);

  // Find last agent response
  const lastAgentMsg = [...chatMessages].reverse().find((m) => m.role === "agent" && m.agentId === agentId);
  if (!lastAgentMsg || !lastAgentMsg.content) return null;

  const title = extractMemorySummary(lastAgentMsg.content);
  const memoryType = classifyMemoryType(lastAgentMsg.content);

  // Create memory node for this agent
  const memory = await svc.create(companyId, {
    title,
    content: lastAgentMsg.content,
    memoryType,
    agentIds: [agentId],
    createdByAgentId: agentId,
    metadata: {
      fromChat: true,
      chatLength: chatMessages.length,
      timestamp: new Date().toISOString(),
    },
  });

  return memory?.id ?? null;
}

/**
 * Find semantically similar memories to link (simple keyword matching for now)
 */
export function findRelatedMemories(
  newMemory: { title: string; content: string },
  existingMemories: Array<{ id: string; title: string; content: string }>,
): string[] {
  const keywords = new Set(
    newMemory.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );

  const relatedIds: string[] = [];

  for (const existing of existingMemories) {
    if (existing.id === newMemory.title) continue; // Skip self

    const existingText = `${existing.title} ${existing.content}`.toLowerCase();
    let matches = 0;

    for (const keyword of keywords) {
      if (existingText.includes(keyword)) matches++;
    }

    // If 50%+ of keywords match, consider it related
    if (matches >= Math.ceil(keywords.size * 0.5)) {
      relatedIds.push(existing.id);
    }
  }

  return relatedIds.slice(0, 3); // Max 3 connections per memory
}
