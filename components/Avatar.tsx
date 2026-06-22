import { avatarColor, initials } from "@/lib/profile/avatar";

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number; // px
}

export default function Avatar({ name, src, size = 40 }: AvatarProps) {
  const dimension = { width: size, height: size, fontSize: size * 0.4 };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary user avatar URL, not a known asset
    return (
      <img
        src={src}
        alt={name}
        style={dimension}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      style={{ ...dimension, backgroundColor: avatarColor(name) }}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
