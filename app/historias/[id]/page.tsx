import { notFound, redirect } from "next/navigation";
import { getStory, storyPath } from "@/lib/api/stories";

type Props = { params: Promise<{ id: string }> };

/** A story by its id (the inbox only knows that): it lives on its lead outlet's article page. */
export default async function StoryRedirect({ params }: Props) {
  const { id } = await params;
  // Up to 9 digits: longer would lose precision as a number, or turn into "1e+21".
  if (!/^\d{1,9}$/.test(id)) notFound();
  const story = await getStory(Number(id));
  if (!story) notFound();
  redirect(storyPath(story));
}
