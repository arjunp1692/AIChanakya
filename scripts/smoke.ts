// Smoke checks against a running app. Usage: pnpm smoke (BASE_URL defaults to http://localhost:3000)
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

type Check = { name: string; run: () => Promise<void> };

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const checks: Check[] = [
  {
    name: "GET /api/health returns ok with db",
    run: async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      assert(res.ok, `status ${res.status}`);
      const body = (await res.json()) as { ok?: boolean; db?: boolean };
      assert(body.ok === true, `ok=${body.ok}`);
      assert(body.db === true, `db=${body.db}`);
    },
  },
];

async function main() {
  let failed = 0;
  for (const check of checks) {
    try {
      await check.run();
      console.log(`PASS  ${check.name}`);
    } catch (err) {
      failed++;
      console.log(`FAIL  ${check.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  process.exit(failed ? 1 : 0);
}

main();

export {};
