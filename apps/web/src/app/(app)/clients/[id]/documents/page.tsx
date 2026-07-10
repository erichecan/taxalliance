import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getClient, getClientDocuments } from "@/lib/queries";
import { DocumentQueue } from "@/components/document-queue";

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const client = await getClient(session.firmId, id);
  if (!client) notFound();
  const docs = await getClientDocuments(session.firmId, id);

  return <DocumentQueue client={client} docs={docs} />;
}
