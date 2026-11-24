import { notFound } from "next/navigation";
import { ReaderPage } from "@/components/admin/ReaderPage";

type Props = { params: Promise<{ id: string }> };

export default async function AdminReaderPage({ params }: Props) {
  const { id } = await params;
  // Up to 9 digits: longer would lose precision as a number.
  if (!/^\d{1,9}$/.test(id)) notFound();
  return <ReaderPage id={Number(id)} />;
}
