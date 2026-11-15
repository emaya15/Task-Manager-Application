import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { parseApiError } from "../utils/errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setField = (name) => (event) => {
    setValues((current) => ({ ...current, [name]: event.target.value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setFormError("");
  };

  const validate = () => {
    const found = {};
    if (!values.email.trim()) found.email = "Email is required.";
    else if (!EMAIL_PATTERN.test(values.email.trim())) found.email = "Enter a valid email address.";
    if (!values.password) found.password = "Password is required.";
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !validate()) return;
    setSubmitting(true);
    setFormError("");
    try {
      await login(values.email.trim(), values.password);
      toast.success("Welcome back!");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const { message, fieldErrors } = parseApiError(error, "Login failed. Please try again.");
      setErrors(fieldErrors);
      setFormError(message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to manage your tasks."
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}
        <FormField id="login-email" label="Email" error={errors.email}>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={setField("email")}
            placeholder="you@example.com"
            autoFocus
          />
        </FormField>
        <FormField id="login-password" label="Password" error={errors.password}>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={setField("password")}
          />
        </FormField>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
