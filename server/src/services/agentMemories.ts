import { and, eq, or } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentMemories, agentMemoryAgents, agentMemoryLinks, agents } from "@paperclipai/db";

export function agentMemoriesService(db: Db) {
  return {
    /** Return all memories + their agent associations + all links for the graph */
    async listGraph(companyId: string) {
      const memories = await db
        .select({
          id: agentMemories.id,
          companyId: agentMemories.companyId,
          title: agentMemories.title,
          content: agentMemories.content,
          memoryType: agentMemories.memoryType,
          metadata: agentMemories.metadata,
          archivedAt: agentMemories.archivedAt,
          createdByAgentId: agentMemories.createdByAgentId,
          createdByUserId: agentMemories.createdByUserId,
          createdAt: agentMemories.createdAt,
          updatedAt: agentMemories.updatedAt,
        })
        .from(agentMemories)
        .where(and(eq(agentMemories.companyId, companyId)));

      const memoryAgentRows = await db
        .select({
          memoryId: agentMemoryAgents.memoryId,
          agentId: agentMemoryAgents.agentId,
          isOwner: agentMemoryAgents.isOwner,
          agentName: agents.name,
          agentIcon: agents.icon,
          agentStatus: agents.status,
        })
        .from(agentMemoryAgents)
        .leftJoin(agents, eq(agentMemoryAgents.agentId, agents.id))
        .where(eq(agentMemoryAgents.companyId, companyId));

      const links = await db
        .select()
        .from(agentMemoryLinks)
        .where(eq(agentMemoryLinks.companyId, companyId));

      // Attach agents to each memory
      const agentsByMemory = new Map<string, typeof memoryAgentRows>();
      for (const row of memoryAgentRows) {
        const list = agentsByMemory.get(row.memoryId) ?? [];
        list.push(row);
        agentsByMemory.set(row.memoryId, list);
      }

      return {
        memories: memories.map((m) => ({
          ...m,
          agents: agentsByMemory.get(m.id) ?? [],
        })),
        links,
      };
    },

    async getById(id: string) {
      return db
        .select()
        .from(agentMemories)
        .where(eq(agentMemories.id, id))
        .then((rows) => rows[0] ?? null);
    },

    async create(
      companyId: string,
      data: {
        title: string;
        content?: string;
        memoryType?: string;
        metadata?: Record<string, unknown>;
        createdByAgentId?: string;
        createdByUserId?: string;
        agentIds?: string[];
      },
    ) {
      const { agentIds, ...fields } = data;
      const [memory] = await db
        .insert(agentMemories)
        .values({ ...fields, companyId })
        .returning();

      if (agentIds && agentIds.length > 0) {
        await db.insert(agentMemoryAgents).values(
          agentIds.map((agentId, i) => ({
            memoryId: memory.id,
            agentId,
            companyId,
            isOwner: i === 0,
          })),
        );
      }

      return memory;
    },

    async update(
      id: string,
      data: {
        title?: string;
        content?: string;
        memoryType?: string;
        metadata?: Record<string, unknown>;
        updatedByAgentId?: string;
        updatedByUserId?: string;
      },
    ) {
      return db
        .update(agentMemories)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(agentMemories.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    async remove(id: string) {
      return db
        .delete(agentMemories)
        .where(eq(agentMemories.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    async createLink(
      companyId: string,
      data: {
        sourceMemoryId: string;
        targetMemoryId: string;
        relationshipType?: string;
        label?: string;
        createdByAgentId?: string;
        createdByUserId?: string;
      },
    ) {
      return db
        .insert(agentMemoryLinks)
        .values({ ...data, companyId })
        .onConflictDoNothing()
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    async removeLink(id: string) {
      return db
        .delete(agentMemoryLinks)
        .where(eq(agentMemoryLinks.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },
  };
}
