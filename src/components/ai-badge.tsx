import { cn } from "@/lib/utils";

/** "AI-generated" label required on every AI output (CLAUDE.md conventions). */
export function AiBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-[1px] text-cyan-blue uppercase",
        className,
      )}
    >
      AI-generated
    </span>
  );
}
