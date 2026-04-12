import type { Db } from "@crewspaceai/db";
import { agentMemoriesService } from "./agentMemories.js";

/**
 * When an agent completes a task, extract and store:
 * - What the task was
 * - How it was solved
 * - Key patterns/approaches used
 * - Constraints/considerations
 */
export interface TaskSolution {
  taskDescription: string;
  approach: string;
  constraints: string[];
  keySteps: string[];
  outcome: string;
}

/**
 * Extract task solution from agent's work/response
 */
export function extractTaskSolution(
  taskTitle: string,
  agentResponse: string,
  executionNotes?: string,
): TaskSolution {
  return {
    taskDescription: taskTitle.slice(0, 200),
    approach: agentResponse.slice(0, 500),
    constraints: extractConstraints(agentResponse),
    keySteps: extractSteps(agentResponse),
    outcome: executionNotes || "Completed",
  };
}

/**
 * Find similar completed tasks in memory to avoid re-LLMing
 */
export async function findSimilarPastTask(
  db: Db,
  companyId: string,
  agentId: string,
  currentTaskDescription: string,
): Promise<any | null> {
  const svc = agentMemoriesService(db);
  const { memories } = await svc.listGraph(companyId);

  // Find memories created by this agent that are task solutions
  const agentTaskMemories = memories.filter(
    (m) =>
      m.agents.some((a) => a.agentId === agentId && a.isOwner) &&
      (m.memoryType === "task" ||
        m.metadata?.isTaskSolution ||
        m.title.toLowerCase().includes("task") ||
        m.title.toLowerCase().includes("solved")),
  );

  // Simple keyword matching for now
  const keywords = new Set(
    currentTaskDescription
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4),
  );

  let bestMatch = null;
  let bestScore = 0;

  for (const memory of agentTaskMemories) {
    const memoryText = `${memory.title} ${memory.content}`.toLowerCase();
    let score = 0;

    for (const keyword of keywords) {
      if (memoryText.includes(keyword)) score++;
    }

    // Need at least 50% keyword match
    if (score >= Math.ceil(keywords.size * 0.5) && score > bestScore) {
      bestMatch = memory;
      bestScore = score;
    }
  }

  return bestMatch;
}

/**
 * Store a completed task as a memory for future reuse
 */
export async function storeTaskSolution(
  db: Db,
  companyId: string,
  agentId: string,
  agentName: string,
  task: TaskSolution,
): Promise<string | null> {
  const svc = agentMemoriesService(db);

  const memory = await svc.create(companyId, {
    title: `Task: ${task.taskDescription.slice(0, 80)}`,
    content: `
**Approach:** ${task.approach}

**Key Steps:**
${task.keySteps.map((s) => `- ${s}`).join("\n")}

**Constraints:**
${task.constraints.map((c) => `- ${c}`).join("\n")}

**Outcome:** ${task.outcome}
    `.trim(),
    memoryType: "task",
    agentIds: [agentId],
    createdByAgentId: agentId,
    metadata: {
      isTaskSolution: true,
      taskType: classifyTask(task.taskDescription),
      difficulty: estimateDifficulty(task.keySteps.length),
      reusable: true,
    },
  });

  return memory?.id ?? null;
}

/**
 * Classify task type (planning, execution, analysis, etc)
 */
function classifyTask(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes("plan") || lower.includes("design")) return "planning";
  if (lower.includes("build") || lower.includes("create")) return "execution";
  if (lower.includes("analyze") || lower.includes("review")) return "analysis";
  if (lower.includes("test") || lower.includes("verify")) return "testing";
  return "general";
}

/**
 * Estimate difficulty based on number of steps
 */
function estimateDifficulty(stepCount: number): string {
  if (stepCount <= 2) return "simple";
  if (stepCount <= 5) return "medium";
  return "complex";
}

/**
 * Extract constraint mentions from text
 */
function extractConstraints(text: string): string[] {
  const constraintKeywords = [
    "must",
    "cannot",
    "limited to",
    "restricted",
    "constraint",
    "only",
    "avoid",
    "don't",
    "requirement",
  ];
  const constraints: string[] = [];

  const sentences = text.split(/[.!?]+/);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (constraintKeywords.some((k) => lower.includes(k))) {
      const trimmed = sentence.trim().slice(0, 120);
      if (trimmed.length > 10) constraints.push(trimmed);
    }
  }

  return constraints.slice(0, 3);
}

/**
 * Extract step-by-step process from text
 */
function extractSteps(text: string): string[] {
  const steps: string[] = [];

  // Look for numbered steps (1., 2., etc)
  const numbered = text.match(/\d+\.\s+([^\n.!?]+)/g);
  if (numbered) {
    return numbered
      .map((s) => s.replace(/^\d+\.\s+/, "").trim().slice(0, 100))
      .filter((s) => s.length > 5)
      .slice(0, 5);
  }

  // Look for bullet points
  const bulleted = text.match(/[-•*]\s+([^\n]+)/g);
  if (bulleted) {
    return bulleted
      .map((s) => s.replace(/^[-•*]\s+/, "").trim().slice(0, 100))
      .filter((s) => s.length > 5)
      .slice(0, 5);
  }

  // Fallback: split by sentences
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 150)
    .slice(0, 3);

  return sentences;
}
