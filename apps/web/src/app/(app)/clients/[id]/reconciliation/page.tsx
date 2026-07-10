import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getClient } from "@/lib/queries";
import { reconcile, bankStatementMonth } from "@/lib/mock";
import { Reconciliation } from "@/components/reconciliation";

export default async function ReconciliationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const client = await getClient(session.firmId, id);
  if (!client) notFound();
  const rows = reconcile(id);

  return <Reconciliation client={client} rows={rows} month={bankStatementMonth} />;
}
