export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[rgba(15,26,46,0.45)] backdrop-blur-[2px]">
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white"
        aria-hidden
      />
      <p className="mt-4 text-[16px] font-semibold text-white">{label}</p>
    </div>
  )
}
