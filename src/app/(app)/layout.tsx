import { Sidebar } from "@/components/Sidebar";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSimulation } from "@/lib/whatsapp";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const unread = await prisma.contact.count({ where: { unread: true } });
  return (
    <div className="min-h-screen">
      <Sidebar userName={session.name} unread={unread} simulation={isSimulation()} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
