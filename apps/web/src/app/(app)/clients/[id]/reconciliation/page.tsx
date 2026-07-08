import { notFound } from "next/navigation";
import { clientById, reconcile, bankStatementMonth } from "@/lib/mock";
import { Reconciliation } from "@/components/reconciliation";

export default async function ReconciliationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = clientById(id);
  if (!client) notFound();
  const rows = reconcile(id);

  return <Reconciliation client={client} rows={rows} month={bankStatementMonth} />;
}
