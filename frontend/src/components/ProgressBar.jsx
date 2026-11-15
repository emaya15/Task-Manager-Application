export default function ProgressBar({ value, label }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      <div className="progress-fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}
