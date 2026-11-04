"use server";

import { requireUser } from "@/server/auth/session";
import { serviceError, type ServiceErrorBody } from "@/server/errors";
import { submitDailyReport } from "@/server/reports/submit";

export type SubmitReportState = { id: string } | ServiceErrorBody;

/** `payload` is the report as JSON; each upload is a `file:<fileKey>` entry. */
export async function submitReportAction(formData: FormData): Promise<SubmitReportState> {
  const user = await requireUser();
  const files = new Map<string, File>();
  for (const [name, value] of formData) {
    if (name.startsWith("file:") && value instanceof File) files.set(name.slice("file:".length), value);
  }
  try {
    const { id } = await submitDailyReport(user, JSON.parse(String(formData.get("payload"))), files);
    return { id };
  } catch (err) {
    const mapped = serviceError(err);
    if (!mapped) throw err;
    return mapped.body;
  }
}
