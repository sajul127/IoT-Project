export function MetricCard({ icon, label, value, accent = 'blue' }) {
  return (
    <section className={`metric-card ${accent}`}>
      {icon()}
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </section>
  )
}
