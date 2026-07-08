import { notFound } from "next/navigation";
import { documentById, clientById, glAccounts } from "@/lib/mock";
import { ReviewWorkbench } from "@/components/review-workbench";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = documentById(id);
  if (!doc) notFound();
  const client = clientById(doc.clientId)!;

  return <ReviewWorkbench doc={doc} client={client} accounts={glAccounts} />;
}
