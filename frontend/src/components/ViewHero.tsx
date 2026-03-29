type Props = {
  title: string
  subtitle: string
}

/** Centered page title block matching reference PhenoRx layout */
export function ViewHero({ title, subtitle }: Props) {
  return (
    <div className="animate-fade-up mb-12 pt-3 text-center">
      <h2 className="font-display text-[32px] font-normal tracking-[-0.02em] text-[var(--px-text)]">
        {title}
      </h2>
      <p className="mt-2 text-[14px] text-[var(--px-text-secondary)]">{subtitle}</p>
    </div>
  )
}
