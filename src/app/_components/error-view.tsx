import { buttonClass } from "@/components/ui";

// Thai fallback UI of the error boundaries (spec 9: errors say what to do next). Presentational only (no
// hooks), so error.tsx and staff/error.tsx share it and it can be unit-rendered.
// The retry control is a raw <button> styled with buttonClass (the unit test finds it by element type).
// The home link is a plain <a>: a full page load is the most reliable way out of a broken client tree.

export const ERROR_TITLE_TH = "โหลดข้อมูลไม่สำเร็จ";
// Heading + hint read as one message: "โหลดข้อมูลไม่สำเร็จ / ลองใหม่อีกครั้ง หรือกลับหน้าแรก".
export const ERROR_HINT_TH = "ลองใหม่อีกครั้ง หรือกลับหน้าแรก";
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
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 md:px-6">
      <section role="alert" className="rounded-card border border-rule-strong bg-surface p-6 text-center shadow-card">
        <h1 className="font-display text-3xl font-semibold text-danger">{ERROR_TITLE_TH}</h1>
        <p className="mt-2 text-ink">{ERROR_HINT_TH}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onRetry} className={buttonClass({ variant: "quiet" })}>
            {RETRY_LABEL_TH}
          </button>
          <a href={homeHref} className={buttonClass({ variant: "quiet" })}>
            {homeLabel}
          </a>
        </div>
        {digest ? <p className="mt-4 text-xs text-muted">รหัสอ้างอิง: {digest}</p> : null}
      </section>
    </main>
  );
}
