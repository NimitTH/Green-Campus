// Thai fallback UI of the error boundaries (spec 9: errors say what to do next). Presentational only (no
// hooks), so error.tsx and staff/error.tsx share it and it can be unit-rendered.
// The home link is a plain <a>: a full page load is the most reliable way out of a broken client tree.

export const ERROR_TITLE_TH = "โหลดข้อมูลไม่สำเร็จ";
export const ERROR_HINT_TH = "โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง หรือกลับหน้าแรก";
export const RETRY_LABEL_TH = "ลองใหม่อีกครั้ง";

export function ErrorView({
  onRetry,
  homeHref = "/",
  homeLabel = "กลับหน้าแรก",
  digest,
}: {
  onRetry: () => void;
  homeHref?: string;
  homeLabel?: string;
  digest?: string;
}) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950">
        <h1 className="text-lg font-semibold text-red-800 dark:text-red-200">{ERROR_TITLE_TH}</h1>
        <p className="mt-2 text-gray-800 dark:text-gray-200">{ERROR_HINT_TH}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onRetry} className="min-h-11 rounded-2xl bg-green-700 px-5 font-semibold text-white hover:bg-green-800">
            {RETRY_LABEL_TH}
          </button>
          <a href={homeHref} className="inline-flex min-h-11 items-center rounded-2xl border border-gray-300 px-5 font-semibold dark:border-gray-700">
            {homeLabel}
          </a>
        </div>
        {digest ? <p className="mt-4 text-xs text-gray-500">รหัสอ้างอิง: {digest}</p> : null}
      </section>
    </main>
  );
}
