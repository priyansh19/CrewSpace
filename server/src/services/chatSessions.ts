import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@crewspaceai/db";
import { chatSessions, chatSessionParticipants, chatMessages, agents } from "@crewspaceai/db";

export function chatSessionsService(db: Db) {
  return {
    async list(companyId: string) {
      const sessions = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.companyId, companyId))
        .orderBy(desc(chatSessions.updatedAt));

      if (sessions.length === 0) return [];

      const sessionIds = sessions.map((s) => s.id);

      const participants = await db
        .select({
          sessionId: chatSessionParticipants.sessionId,
          agentId: chatSessionParticipants.agentId,
          agentName: agents.name,
          agentIcon: agents.icon,
          agentStatus: agents.status,
        })
        .from(chatSessionParticipants)
        .leftJoin(agents, eq(chatSessionParticipants.agentId, agents.id))
        .where(sql`${chatSessionParticipants.sessionId} = ANY(ARRAY[${sql.join(sessionIds.map((id) => sql`${id}::uuid`), sql`, `)}])`);

      const lastMessages = await db
        .selectDistinctOn([chatMessages.sessionId], {
          sessionId: chatMessages.sessionId,
          content: chatMessages.content,
          role: chatMessages.role,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .where(sql`${chatMessages.sessionId} = ANY(ARRAY[${sql.join(sessionIds.map((id) => sql`${id}::uuid`), sql`, `)}])`)
        .orderBy(chatMessages.sessionId, desc(chatMessages.createdAt));

      const participantsBySession = new Map<string, typeof participants>();
      for (const p of participants) {
        const list = participantsBySession.get(p.sessionId) ?? [];
        list.push(p);
        participantsBySession.set(p.sessionId, list);
      }
      const lastMessageBySession = new Map(lastMessages.map((m) => [m.sessionId, m]));

      return sessions.map((s) => ({
        ...s,
        participants: participantsBySession.get(s.id) ?? [],
        lastMessage: lastMessageBySession.get(s.id) ?? null,
      }));
    },

    async getWithMessages(id: string) {
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, id));

      if (!session) return null;

      const participants = await db
        .select({
          sessionId: chatSessionParticipants.sessionId,
          agentId: chatSessionParticipants.agentId,
          agentName: agents.name,
          agentIcon: agents.icon,
          agentStatus: agents.status,
        })
        .from(chatSessionParticipants)
        .leftJoin(agents, eq(chatSessionParticipants.agentId, agents.id))
        .where(eq(chatSessionParticipants.sessionId, id));

      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, id))
        .orderBy(asc(chatMessages.createdAt));

      return { ...session, participants, messages };
    },

    async create(companyId: string, input: { primaryAgentId: string; participantIds: string[]; name?: string }) {
      const [session] = await db
        .insert(chatSessions)
        .values({ companyId, primaryAgentId: input.primaryAgentId, name: input.name ?? null })
        .returning();

      const participantIds = Array.from(new Set([input.primaryAgentId, ...input.participantIds]));
      if (participantIds.length > 0) {
        await db.insert(chatSessionParticipants).values(
          participantIds.map((agentId) => ({ sessionId: session.id, agentId })),
        );
      }

      return session;
    },

    async rename(id: string, name: string) {
      const [session] = await db
        .update(chatSessions)
        .set({ name: name.trim() || null, updatedAt: new Date() })
        .where(eq(chatSessions.id, id))
        .returning();
      return session ?? null;
    },

    async remove(id: string) {
      await db.delete(chatSessions).where(eq(chatSessions.id, id));
    },

    async appendMessage(sessionId: string, input: { role: string; content: string; agentId?: string | null }) {
      const [message] = await db
        .insert(chatMessages)
        .values({ sessionId, role: input.role, content: input.content, agentId: input.agentId ?? null })
        .returning();

      await db
        .update(chatSessions)
        .set({ updatedAt: new Date() })
        .where(eq(chatSessions.id, sessionId));

      return message;
    },
  };
}
