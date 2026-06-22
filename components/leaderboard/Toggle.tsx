import Link from "next/link";

interface ToggleProps {
  options: { value: string; label: string }[];
  current: string;
  hrefFor: (value: string) => string;
}

export default function Toggle({ options, current, hrefFor }: ToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 p-0.5 text-sm">
      {options.map((o) => (
        <Link
          key={o.value}
          href={hrefFor(o.value)}
          className={`rounded-md px-3 py-1 transition-colors ${
            current === o.value
              ? "bg-amber-400 font-semibold text-zinc-950"
              : "text-zinc-300 hover:text-white"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
