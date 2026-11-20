import { permanentRedirect } from "next/navigation";
import { boardPath, boardQuery } from "@/lib/ideas";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The board moved to /feedback, the main page of Feedback; old links keep their filter where it still exists. */
export default async function OldIdeasPage({ searchParams }: Props) {
  const params = await searchParams;
  // «ativas» is «A discutir» now; the rest read as they did.
  const ordem = params.ordem === "ativas" ? "a-discutir" : params.ordem;
  const estado = params.estado === "em-desenvolvimento" ? "a-fazer" : params.estado === "recusadas" ? "nao-vamos-fazer" : params.estado;
  permanentRedirect(boardPath(boardQuery({ ...params, ordem, estado })));
}
