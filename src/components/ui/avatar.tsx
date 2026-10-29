import { avatarInitial } from "@/lib/profile/avatar";

const SIZE: Record<28 | 36 | 48 | 72, { box: string; text: string }> = {
  28: { box: "size-7", text: "text-sm" },
  36: { box: "size-9", text: "text-base" },
  48: { box: "size-12", text: "text-xl" },
  72: { box: "size-[72px]", text: "text-3xl" },
};

/** Profile picture, or the name's first letter on an accent circle. Decorative: the name is always shown beside it. */
export function Avatar({
  name,
  url,
  size,
  className,
}: {
  name: string;
  url: string | null;
  size: 28 | 36 | 48 | 72;
  className?: string;
}) {
  const s = SIZE[size];
  const base = `${s.box} shrink-0 rounded-full`;
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className={[base, "object-cover", className].filter(Boolean).join(" ")} />;
  }
  return (
    <span
      aria-hidden="true"
      className={[base, s.text, "inline-flex items-center justify-center bg-accent font-semibold text-on-accent", className]
        .filter(Boolean)
        .join(" ")}
    >
      {avatarInitial(name)}
    </span>
  );
}
