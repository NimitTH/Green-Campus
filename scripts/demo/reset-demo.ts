// Reset the demo data (spec 13.2 mode 1; ruling R138): delete everything the seed created (seed-domain
// users, seed activities / rewards / articles and their storage objects), then run the seed again.
// Never touches a user outside @seed.greencampus.example; refuses (and changes nothing) if a real user has
// data on seed content: run demo:purge first in that case.
//   CONFIRM_PROJECT_REF=<ref> DATABASE_URL=... DEMO_PASSWORD=... npm run demo:reset
import { openContext, runScript, type Ctx } from "./lib/context.ts";
import { insertSeed } from "./lib/build.ts";
import { removeSeedData } from "./lib/remove.ts";

const ref: { ctx?: Ctx } = {};
await runScript(async () => {
  const ctx = (ref.ctx = await openContext({ needDemoPassword: true }));
  ctx.log(`demo:reset -> project "${ctx.ref}"`);
  const removed = await removeSeedData(ctx);
  ctx.log(`ลบข้อมูลสาธิตเดิม / removed: ${JSON.stringify(removed)}`);
  const added = await insertSeed(ctx);
  ctx.log(`ใส่ข้อมูลสาธิตใหม่ / seeded: ${JSON.stringify(added)}`);
}, ref);
