import { notFound } from "next/navigation";
import { clientById, documentsByClient } from "@/lib/mock";
import { DocumentQueue } from "@/components/document-queue";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = clientById(id);
  if (!client) notFound();
  const docs = documentsByClient(id);

  return <DocumentQueue client={client} docs={docs} />;
}
