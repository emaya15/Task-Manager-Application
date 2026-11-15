/** Label + control + inline error. `children` is the input/select/textarea. */
export default function FormField({ id, label, error, hint, children }) {
  return (
    <div className={`field${error ? " field-invalid" : ""}`}>
      {label && (
        <label htmlFor={id}>
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
