/** Reward photo from the public bucket, or a placeholder when there is none. */
export function RewardImage({ url, className = "" }: { url: string | null; className?: string }) {
  if (!url) {
    return (
      <div
        aria-hidden="true"
        className={`flex items-center justify-center bg-gray-100 text-3xl dark:bg-gray-800 ${className}`}
      >
        🎁
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL, already resized in the browser
    <img src={url} alt="" loading="lazy" className={`object-cover ${className}`} />
  );
}
