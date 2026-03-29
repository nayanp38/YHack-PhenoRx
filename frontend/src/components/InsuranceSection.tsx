import { ShieldCheck } from 'lucide-react'

type Props = {
  statement: string | null
}

export function InsuranceSection({ statement }: Props) {
  if (!statement) return null

  return (
    <section className="mb-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[#a78bfa]" aria-hidden />
        <h3 className="font-display text-[16px] font-medium text-[#c4b5fd]">
          Insurance Coverage Summary
        </h3>
      </div>
      <div className="summary-callout summary-callout--insurance">
        <p className="text-[14px] leading-relaxed text-[var(--px-text)]">{statement}</p>
      </div>
    </section>
  )
}
