import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/session";
import { getClientsForFirm, getFirm } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [clients, firm] = await Promise.all([
    getClientsForFirm(session.firmId),
    getFirm(session.firmId),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar clients={clients} firmName={firm?.name ?? "易账"} />
      <main className="flex-1 overflow-y-auto bg-paper">{children}</main>
    </div>
  );
}
