import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { ForbiddenError } from "@/server/authz";
import { getAttachmentDownload } from "@/server/tickets/attachments";

/** Downloads an attachment (or redirects to a link) if the session user can view its ticket. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, role, departmentId } = session.user;

  try {
    const found = await getAttachmentDownload({ id, role, departmentId }, (await params).id);
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (found.kind === "LINK") return NextResponse.redirect(found.url);
    return new NextResponse(new Uint8Array(found.data), {
      headers: {
        "Content-Type": found.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(found.name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
