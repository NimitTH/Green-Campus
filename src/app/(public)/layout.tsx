import { SiteFooter } from "../_components/site-footer";
import { SiteHeader } from "../_components/site-header";

// Public shell (/articles, spec 9.1). No session read here, so the pages stay cacheable for everyone.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </div>
  );
}
