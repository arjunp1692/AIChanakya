import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

/** Raw `Setting.value` for `key` (undefined if unset). Memoised per request. */
export const getSettingValue = cache(async (key: string): Promise<Prisma.JsonValue | undefined> => {
  const row = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
  return row?.value;
});
