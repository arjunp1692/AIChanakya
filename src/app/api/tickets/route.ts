import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { serviceError } from "@/server/errors";
import { createTicket } from "@/server/tickets/service";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, role, departmentId } = session.user;

  try {
    const ticket = await createTicket({ id, role, departmentId }, await req.json());
    return NextResponse.json({ id: ticket.id, ticketNo: ticket.ticketNo }, { status: 201 });
  } catch (err) {
    const mapped = serviceError(err);
    if (!mapped) throw err;
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
