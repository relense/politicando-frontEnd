import { notFound, redirect } from "next/navigation";
import { getStory, storyPath } from "@/lib/api/stories";

type Props = { params: Promise<{ id: string }> };

/** A story by its id (the inbox only knows that): it lives on its lead outlet's article page. */
export default async function StoryRedirect({ params }: Props) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const story = await getStory(Number(id));
  if (!story) notFound();
  redirect(storyPath(story));
}
