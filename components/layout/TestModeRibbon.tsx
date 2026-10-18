/** Global TEST MODE ribbon. Rendered only when test accounts are enabled (server decides). */
export function TestModeRibbon({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex h-7 items-center justify-center gap-2 bg-[repeating-linear-gradient(135deg,#ff7d09_0_12px,#e36c00_12px_24px)] text-[11px] font-semibold text-[#130800]"
    >
      <span className="rounded-sm bg-[#130800] px-1.5 py-px text-[10px] tracking-[0.2em] text-ember" dir="ltr">
        TEST
      </span>
      {label}
    </div>
  );
}
