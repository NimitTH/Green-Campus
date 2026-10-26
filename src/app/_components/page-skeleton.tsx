export function PageSkeleton() {
  return (
    <div aria-busy="true" className="space-y-3 p-4 md:px-6 xl:px-10 motion-safe:animate-pulse">
      <p className="text-sm text-muted">กำลังโหลด...</p>
      <div className="h-6 w-2/3 rounded-input bg-paper-2" />
      <div className="h-24 rounded-card bg-paper-2" />
    </div>
  );
}
