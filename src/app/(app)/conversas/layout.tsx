import { prisma } from "@/lib/db";
import { ConversationList } from "./ConversationList";

export const dynamic = "force-dynamic";

export default async function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const contacts = await prisma.contact.findMany({
    where: { messages: { some: {} } },
    orderBy: [{ unread: "desc" }, { lastInteractionAt: { sort: "desc", nulls: "last" } }],
    take: 200,
    select: {
      id: true, name: true, unread: true, stage: true, lastInteractionAt: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, direction: true, createdAt: true } },
    },
  });
  const items = contacts.map((c) => ({
    id: c.id, name: c.name, unread: c.unread, stage: c.stage,
    last: c.messages[0]?.body ?? "", lastIn: c.messages[0]?.direction === "IN", at: (c.messages[0]?.createdAt ?? c.lastInteractionAt)?.toISOString() ?? null,
  }));
  return (
    <div className="card grid h-[calc(100vh-4rem)] overflow-hidden lg:h-[calc(100vh-4rem)] lg:grid-cols-[320px_1fr]">
      <ConversationList items={items} />
      <div className="flex min-h-0 flex-col">{children}</div>
    </div>
  );
}
