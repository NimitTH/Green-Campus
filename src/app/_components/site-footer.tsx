import Link from "next/link";
import { SocialIcon } from "./social-icons";
import { visibleSocialLinks } from "./social-links";
import { LeafMark } from "./leaf-mark";

const FOOT_LINK = "inline-flex min-h-11 items-center text-sm text-ink underline-offset-4 hover:text-accent hover:underline";

export function SiteFooter() {
  const social = visibleSocialLinks();
  return (
    <footer className="bg-paper-2 py-10">
      <div className="mx-auto grid w-full max-w-[70rem] gap-8 px-4 md:grid-cols-[2fr_1fr_1fr] md:px-6">
        <div>
          <p className="inline-flex items-center gap-2 font-display text-lg font-semibold text-accent">
            <LeafMark />
            Green Campus
          </p>
          <p className="mt-2 text-sm text-ink">ระบบจัดการขยะในวิทยาลัย</p>
          <p className="mt-1 text-sm text-muted">ค่า carbon อ้างอิง อบก. LESS-WM-01 v06</p>
          {social.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1">
              {social.map((l) => (
                <li key={l.platform}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={l.label}
                    className="inline-flex size-11 items-center justify-center rounded-input text-ink hover:bg-accent-soft hover:text-accent"
                  >
                    <SocialIcon platform={l.platform} />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <p className="font-display font-semibold text-ink">เริ่มต้น</p>
          <ul className="mt-1">
            <li>
              <Link href="/register" className={FOOT_LINK}>สมัครสมาชิก</Link>
            </li>
            <li>
              <Link href="/login" className={FOOT_LINK}>เข้าสู่ระบบ</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-display font-semibold text-ink">อ่าน</p>
          <ul className="mt-1">
            <li>
              <Link href="/articles" className={FOOT_LINK}>บทความ</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
