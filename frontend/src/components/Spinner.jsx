export default function Spinner({ label = "Loading…", fullPage = false, small = false }) {
  const spinner = (
    <div className={`spinner-wrap${small ? " spinner-small" : ""}`} role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {!small && <span className="spinner-label">{label}</span>}
      {small && <span className="sr-only">{label}</span>}
    </div>
  );
  return fullPage ? <div className="fullpage-center">{spinner}</div> : spinner;
}
