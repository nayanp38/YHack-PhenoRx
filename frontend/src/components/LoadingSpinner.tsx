export function LoadingSpinner({
  label = 'Running phenoconversion engine…',
  sub = 'Analyzing drug-drug-gene interactions',
}: {
  label?: string
  sub?: string
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{ background: 'rgba(10,10,11,0.9)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="h-12 w-12 rounded-full border-2"
        style={{
          borderColor: 'var(--px-border)',
          borderTopColor: 'var(--px-accent)',
          animation: 'spin 0.8s linear infinite',
        }}
        aria-hidden
      />
      <p className="mt-5 font-display text-[18px] italic text-[var(--px-text)]">{label}</p>
      <p className="mt-1.5 text-[12px] text-[var(--px-text-secondary)]">{sub}</p>
    </div>
  )
}
