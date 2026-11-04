// Timing check: logs in as CEO and times key pages (cold first hit, then warm median of 5).
// Usage: pnpm perf [baseUrl]  (default http://localhost:3000; run against `pnpm dev` or `pnpm preview`)
import { PrismaClient } from "@prisma/client";

const base = process.argv[2] ?? "http://localhost:3000";
const cookies = new Map<string, string>();

function store(res: Response) {
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    cookies.set(pair.slice(0, i), pair.slice(i + 1));
  }
}
const cookieHeader = () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");

async function get(path: string) {
  const t = performance.now();
  const res = await fetch(base + path, { headers: { cookie: cookieHeader() }, redirect: "manual" });
  await res.text();
  return { status: res.status, ms: Math.round(performance.now() - t) };
}

async function login() {
  const r = await fetch(`${base}/api/auth/csrf`);
  store(r);
  const { csrfToken } = (await r.json()) as { csrfToken: string };
  const res = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken, email: "ceo@kubera.local", password: "Password@123" }),
    redirect: "manual",
  });
  store(res);
}

async function main() {
  const prisma = new PrismaClient();
  const t = await prisma.ticket.findFirst({ orderBy: { updatedAt: "desc" }, select: { ticketNo: true } });
  await prisma.$disconnect();
  await login();
  const paths = ["/api/health", "/", "/tickets", "/tickets?q=a&sort=dueDate", "/tickets/new"];
  if (t) paths.push(`/tickets/${t.ticketNo}`);
  for (const p of paths) {
    const first = await get(p);
    const warm: number[] = [];
    for (let i = 0; i < 5; i++) warm.push((await get(p)).ms);
    warm.sort((a, b) => a - b);
    console.log(`${p.padEnd(32)} ${first.status}  first ${String(first.ms).padStart(5)}ms  warm p50 ${warm[2]}ms`);
  }
}

main();
