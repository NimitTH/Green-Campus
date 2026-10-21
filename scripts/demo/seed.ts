// Demo seed (spec 13.1, 13.2; rulings R135-R137). Idempotent: removes the previous seed, then inserts it again.
//   CONFIRM_PROJECT_REF=<ref> DATABASE_URL=... DEMO_PASSWORD=... npm run demo:seed
// See docs/demo-checklist.md. Prints counts only (never e-mails, ids, passwords or keys).
import { openContext, runScript, type Ctx } from "./lib/context.ts";
import { insertSeed } from "./lib/build.ts";
import { removeSeedData } from "./lib/remove.ts";

const ref: { ctx?: Ctx } = {};
await runScript(async () => {
  const ctx = (ref.ctx = await openContext({ needDemoPassword: true }));
  ctx.log(`demo:seed -> project "${ctx.ref}"`);
  const removed = await removeSeedData(ctx);
  ctx.log(`ลบข้อมูลตัวอย่างเดิม / removed previous seed: ${JSON.stringify(removed)}`);
  const added = await insertSeed(ctx);
  ctx.log(`ใส่ข้อมูลตัวอย่าง / seeded: ${JSON.stringify(added)}`);
}, ref);
