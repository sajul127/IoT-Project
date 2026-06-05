export function MetricCard({ icon, label, value, accent = 'blue' }) {
  const accentClass = {
    blue: 'text-[#2563eb]',
    violet: 'text-[#8b5cf6]',
    green: 'text-[#10b981]',
  }[accent] ?? 'text-[#2563eb]'

  return (
    <section className="flex min-h-[78px] items-center gap-3 rounded-lg border border-[#e0e7f0] bg-white p-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
      <div className={accentClass}>{icon()}</div>
      <div>
        <p className="mb-1 mt-0 text-xs font-bold text-[#64748b]">{label}</p>
        <strong className="text-[17px] text-[#0f172a]">{value}</strong>
      </div>
    </section>
  )
}
