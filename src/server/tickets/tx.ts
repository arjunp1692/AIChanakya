import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

export type Tx = Prisma.TransactionClient;

/** Lets a composite flow (the daily report) run ticket services inside its own transaction. */
export type ServiceOpts = {
  tx?: Tx;
  /** Written on every ticket event and attachment as the change's source. */
  reportId?: string;
  /** Collects stored file keys so the caller can delete them if its transaction fails. */
  storedKeys?: string[];
};

/** Reads must go through this so they see the caller's uncommitted writes. */
export const dbOf = (opts: ServiceOpts) => opts.tx ?? prisma;

export const inTx = <T>(opts: ServiceOpts, fn: (tx: Tx) => Promise<T>): Promise<T> =>
  opts.tx ? fn(opts.tx) : prisma.$transaction(fn);
