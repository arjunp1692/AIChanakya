"use client";

import { useEffect, useState, type ReactNode } from "react";
import { STATUS_LABELS } from "@/lib/constants";
import type { SimilarTicket } from "@/server/tickets/similar";
import { similarTicketsAction } from "./actions";

const MIN_TITLE_LENGTH = 5;
const DEBOUNCE_MS = 400;

/** Open tickets resembling `title`, looked up as the user types. Pass a blank department to switch it off. */
export function useSimilarTickets(departmentId: string, title: string): SimilarTicket[] {
  const [matches, setMatches] = useState<SimilarTicket[]>([]);
  const query = title.trim();
  const enabled = !!departmentId && query.length >= MIN_TITLE_LENGTH;

  useEffect(() => {
    if (!enabled) {
      setMatches([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(async () => {
      const found = await similarTicketsAction(departmentId, query);
      if (!stale) setMatches(found);
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [departmentId, query, enabled]);

  return matches;
}

/** The matches, each with `action` (link or button), then the "Create anyway" confirmation in `children`. */
export function SimilarTicketsNotice({
  matches,
  action,
  children,
}: {
  matches: SimilarTicket[];
  action: (ticket: SimilarTicket) => ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border border-divider bg-surface p-3 text-sm">
      {matches.length > 0 && (
        <>
          <p className="font-medium">This may already exist:</p>
          <ul className="space-y-1.5">
            {matches.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {t.ticketNo} — {t.title}{" "}
                  <span className="text-muted-foreground">· {STATUS_LABELS[t.status]}</span>
                </span>
                {action(t)}
              </li>
            ))}
          </ul>
        </>
      )}
      {children}
    </div>
  );
}
