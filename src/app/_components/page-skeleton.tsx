export function PageSkeleton() {
  return (
    <div aria-busy="true" className="animate-pulse space-y-3 p-4">
      <p className="text-sm text-gray-500">กำลังโหลด...</p>
      <div className="h-6 w-2/3 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="h-24 rounded bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}
