import { avatarColor, initials } from "@/lib/profile/avatar";

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number; // px
  ring?: boolean; // neon gradient ring (profile headers)
}

export default function Avatar({ name, src, size = 40, ring = false }: AvatarProps) {
  const dimension = { width: size, height: size, fontSize: size * 0.4 };
  const inner = src ? (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary user avatar URL, not a known asset
    <img src={src} alt={name} style={dimension} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span
      style={{ ...dimension, backgroundColor: avatarColor(name) }}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      aria-label={name}
    >
      {initials(name)}
    </span>
  );

  if (!ring) return inner;
  return (
    <span
      className="glow inline-flex shrink-0 rounded-full p-[2px]"
      style={{
        background: "linear-gradient(135deg, var(--cyan), var(--magenta))",
        ["--glow" as string]: "rgba(255,45,120,.45)",
      }}
    >
      {inner}
    </span>
  );
}
