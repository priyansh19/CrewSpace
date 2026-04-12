/**
 * Memory Extractor — extracts key facts/insights from agent conversations
 * and stores them as agent memories (RAG data) per agent.
 *
 * Extraction runs after a chat session completes and is fire-and-forget
 * (errors are logged, never propagated to the caller).
 */

import { spawn } from "node:child_process";
import type { Db } from "@crewspaceai/db";
import { agentMemoriesService } from "./agentMemories.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const EXTRACT_PROMPT = (agentName: string, conversation: string) => `
You are a knowledge extraction system for the AI agent "${agentName}".

Analyze the following conversation and extract 0–5 distinct, reusable memories that ${agentName} should retain for future reference. Focus on:
- Facts learned (user preferences, system constraints, domain knowledge)
- Decisions made and their rationale
- Patterns or recurring themes
- Actionable insights or learnings
- Important context about ongoing tasks or goals

For each memory, output a JSON object on its own line (NDJSON format). Use ONLY these fields:
  { "title": "short title (< 60 chars)", "content": "1-3 sentences of context", "memoryType": "fact|insight|decision|pattern|task|observation|learning" }

If nothing significant was discussed, output an empty line. Do NOT output anything else — only NDJSON lines or blank lines.

Conversation:
${conversation}
`.trim();

/**
 * Extract memories from a completed chat session and store them in the DB.
 * This is fire-and-forget — errors are caught and logged.
 */
export async function extractAndStoreMemories(
  db: Db,
  opts: {
    companyId: string;
    agentId: string;
    agentName: string;
    claudeCmd: string;
    homeDir: string;
    messages: ChatMessage[];
  },
): Promise<void> {
  const { companyId, agentId, agentName, claudeCmd, homeDir, messages } = opts;

  if (messages.length < 2) return; // Not enough context to extract

  const conversation = messages
    .map((m) => `${m.role === "user" ? "User" : agentName}: ${m.content}`)
    .join("\n\n");

  const prompt = EXTRACT_PROMPT(agentName, conversation);
  const svc = agentMemoriesService(db);

  try {
    const output = await runClaude(claudeCmd, homeDir, prompt);
    if (!output.trim()) return;

    const lines = output.split("\n").filter((l) => l.trim().startsWith("{"));
    for (const line of lines.slice(0, 5)) {
      try {
        const parsed = JSON.parse(line.trim()) as {
          title?: unknown;
          content?: unknown;
          memoryType?: unknown;
        };
        const title = typeof parsed.title === "string" ? parsed.title.trim() : null;
        const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
        const memoryType = typeof parsed.memoryType === "string" ? parsed.memoryType : "fact";

        if (!title || title.length < 3) continue;

        await svc.create(companyId, {
          title: title.slice(0, 200),
          content: content.slice(0, 2000),
          memoryType,
          createdByAgentId: agentId,
          agentIds: [agentId],
        });
      } catch {
        // Malformed JSON line — skip
      }
    }
  } catch (err) {
    console.warn(`[memory-extractor] extraction failed for agent ${agentId}:`, (err as Error).message);
  }
}

function runClaude(claudeCmd: string, homeDir: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      claudeCmd,
      ["--print", "-", "--output-format", "text", "--dangerously-skip-permissions"],
      { env: { ...process.env, HOME: homeDir } },
    );

    proc.stdin.write(prompt);
    proc.stdin.end();

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("memory extraction timed out"));
    }, 30_000);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude exited ${code}: ${stderr.slice(0, 200)}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Retrieve agent memories as RAG context string for injection into prompts.
 * Returns an empty string if no memories exist.
 */
export async function getMemoryContext(
  db: Db,
  opts: { companyId: string; agentId: string; maxMemories?: number },
): Promise<string> {
  const { companyId, agentId, maxMemories = 12 } = opts;
  const svc = agentMemoriesService(db);

  try {
    const { memories } = await svc.listGraph(companyId);

    // Filter to memories associated with this agent
    const agentMems = memories
      .filter((m) => m.agents.some((a) => a.agentId === agentId))
      .slice(0, maxMemories);

    if (agentMems.length === 0) return "";

    const lines = agentMems.map((m) =>
      `- [${m.memoryType}] ${m.title}${m.content ? ": " + m.content : ""}`,
    );

    return `\n\n## Your Memory Context (from past interactions)\n${lines.join("\n")}\nUse this context to inform your response where relevant.\n`;
  } catch {
    return "";
  }
}
