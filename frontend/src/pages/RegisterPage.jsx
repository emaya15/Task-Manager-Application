import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { parseApiError } from "../utils/errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [values, setValues] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    password_confirm: "",
  });
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
    if (!values.first_name.trim()) found.first_name = "First name is required.";
    if (!values.last_name.trim()) found.last_name = "Last name is required.";
    if (!values.email.trim()) found.email = "Email is required.";
    else if (!EMAIL_PATTERN.test(values.email.trim())) found.email = "Enter a valid email address.";
    if (!values.password) found.password = "Password is required.";
    else if (values.password.length < 8) found.password = "Password must be at least 8 characters.";
    if (!values.password_confirm) found.password_confirm = "Please confirm your password.";
    else if (values.password !== values.password_confirm) found.password_confirm = "Passwords do not match.";
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !validate()) return;
    setSubmitting(true);
    setFormError("");
    try {
      await register({
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: values.email.trim(),
        password: values.password,
        password_confirm: values.password_confirm,
      });
      toast.success("Account created! You can log in now.");
      navigate("/login", { replace: true });
    } catch (error) {
      const { message, fieldErrors } = parseApiError(error, "Registration failed. Please try again.");
      setErrors(fieldErrors);
      setFormError(Object.keys(fieldErrors).length ? "" : message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start organising your tasks in minutes."
      footer={
        <>
          Already registered? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}
        <div className="form-grid">
          <FormField id="reg-first" label="First name" error={errors.first_name}>
            <input
              id="reg-first"
              type="text"
              autoComplete="given-name"
              value={values.first_name}
              onChange={setField("first_name")}
              autoFocus
            />
          </FormField>
          <FormField id="reg-last" label="Last name" error={errors.last_name}>
            <input
              id="reg-last"
              type="text"
              autoComplete="family-name"
              value={values.last_name}
              onChange={setField("last_name")}
            />
          </FormField>
        </div>
        <FormField id="reg-email" label="Email" error={errors.email}>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={setField("email")}
            placeholder="you@example.com"
          />
        </FormField>
        <FormField id="reg-password" label="Password" error={errors.password} hint="At least 8 characters.">
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={setField("password")}
          />
        </FormField>
        <FormField id="reg-confirm" label="Confirm password" error={errors.password_confirm}>
          <input
            id="reg-confirm"
            type="password"
            autoComplete="new-password"
            value={values.password_confirm}
            onChange={setField("password_confirm")}
          />
        </FormField>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
