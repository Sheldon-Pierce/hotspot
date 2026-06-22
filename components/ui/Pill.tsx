const TONES = {
  neutral: "bg-white/[.07] text-zinc-300 border-white/10",
  deal: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  live: "bg-white/[.05] text-white border-white/10",
} as const;

export default function Pill({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
