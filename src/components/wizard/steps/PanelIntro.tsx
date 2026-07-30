export function PanelIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-[19px] font-semibold tracking-[-.01em] text-ink">{title}</h2>
      <p className="text-[13px] text-muted">{subtitle}</p>
    </div>
  );
}
