/** The title with the searched words marked, as text (never HTML). */
export function Highlight({ text, query }: { text: string; query: string }) {
  const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const words = fold(query)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
  if (words.length === 0) return <>{text}</>;
  // Split on word boundaries and mark the words that start with a searched one.
  return (
    <>
      {text.split(/(\p{L}+|\p{N}+)/u).map((part, index) =>
        words.some((word) => fold(part).startsWith(word)) ? (
          <mark key={index} className="rounded-sm bg-[var(--marker)] px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
