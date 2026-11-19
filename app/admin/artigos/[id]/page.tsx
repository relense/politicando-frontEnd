import { notFound } from "next/navigation";
import { PostEditor } from "@/components/admin/PostEditor";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  return <PostEditor id={Number(id)} />;
}
