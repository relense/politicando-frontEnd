/** The site's name as in the header: the first letter in the icon's gold. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-logo font-bold tracking-[0.2em] ${className}`}>
      <span className="text-brand">P</span>OLITICANDO
    </span>
  );
}
