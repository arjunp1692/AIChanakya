// Display formatting in Asia/Kolkata. Formatters are built once: `toLocale*String(…, { timeZone })`
// constructs a new Intl formatter on every call (~100× slower).
const TZ = "Asia/Kolkata";

const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, dateStyle: "medium" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
const isoDayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

/** e.g. "3 Nov 2026". */
export const fmtDate = (d: Date) => dateFmt.format(d);

/** e.g. "3 Nov 2026, 4:05 pm". */
export const fmtDateTime = (d: Date) => dateTimeFmt.format(d);

/** "YYYY-MM-DD" IST calendar day (for date inputs). */
export const isoDateIST = (d: Date) => isoDayFmt.format(d);
