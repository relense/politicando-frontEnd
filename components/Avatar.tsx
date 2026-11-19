/** A letter in a circle: anonymous posts share one grey avatar; a chosen name always gets the same muted colour. */
export function NameAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const anonymous = name === "anon" || name === "Anónimo";
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-mono font-bold uppercase ${
        size === "sm" ? "size-6 text-[11px]" : "size-8 text-sm"
      } ${anonymous ? "bg-line text-ink" : "text-white"}`}
      style={anonymous ? undefined : { backgroundColor: `hsl(${hash % 360} 32% 40%)` }}
    >
      {anonymous ? "?" : name[0]}
    </span>
  );
}

/** A side, as a tinted tag: green for, red against. */
export function SideTag({ tone, children }: { tone: "favor" | "contra"; children: React.ReactNode }) {
  const color = `var(--${tone})`;
  return (
    <span
      className="rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
      style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      {children}
    </span>
  );
}
