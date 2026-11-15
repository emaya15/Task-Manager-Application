import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../api/auth";
import FormField from "../components/FormField";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { parseApiError } from "../utils/errors";
import { formatDate } from "../utils/format";

function ProfileDetails() {
  const { user, saveProfile } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({ first_name: user.first_name, last_name: user.last_name });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const setField = (name) => (event) => {
    setValues((current) => ({ ...current, [name]: event.target.value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const found = {};
    if (!values.first_name.trim()) found.first_name = "First name is required.";
    if (!values.last_name.trim()) found.last_name = "Last name is required.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await saveProfile({ first_name: values.first_name.trim(), last_name: values.last_name.trim() });
      toast.success("Profile updated.");
    } catch (error) {
      const { message, fieldErrors } = parseApiError(error, "Could not update your profile.");
      setErrors(fieldErrors);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h2>Your details</h2>
      <dl className="profile-facts">
        <div>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>Member since</dt>
          <dd>{formatDate(user.date_joined?.slice(0, 10))}</dd>
        </div>
      </dl>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <FormField id="profile-first" label="First name" error={errors.first_name}>
            <input id="profile-first" type="text" value={values.first_name} onChange={setField("first_name")} />
          </FormField>
          <FormField id="profile-last" label="Last name" error={errors.last_name}>
            <input id="profile-last" type="text" value={values.last_name} onChange={setField("last_name")} />
          </FormField>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </section>
  );
}

const EMPTY_PASSWORDS = { old_password: "", new_password: "", new_password_confirm: "" };

function ChangePasswordForm() {
  const toast = useToast();
  const [values, setValues] = useState(EMPTY_PASSWORDS);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const setField = (name) => (event) => {
    setValues((current) => ({ ...current, [name]: event.target.value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const validate = () => {
    const found = {};
    if (!values.old_password) found.old_password = "Enter your current password.";
    if (!values.new_password) found.new_password = "Enter a new password.";
    else if (values.new_password.length < 8) found.new_password = "Password must be at least 8 characters.";
    if (!values.new_password_confirm) found.new_password_confirm = "Please confirm the new password.";
    else if (values.new_password !== values.new_password_confirm) found.new_password_confirm = "Passwords do not match.";
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !validate()) return;
    setSubmitting(true);
    try {
      await changePassword(values);
      toast.success("Password changed successfully.");
      setValues(EMPTY_PASSWORDS);
    } catch (error) {
      const { message, fieldErrors } = parseApiError(error, "Could not change the password.");
      setErrors(fieldErrors);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h2>Change password</h2>
      <form onSubmit={handleSubmit} noValidate>
        <FormField id="pw-old" label="Current password" error={errors.old_password}>
          <input
            id="pw-old"
            type="password"
            autoComplete="current-password"
            value={values.old_password}
            onChange={setField("old_password")}
          />
        </FormField>
        <FormField id="pw-new" label="New password" error={errors.new_password} hint="At least 8 characters.">
          <input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            value={values.new_password}
            onChange={setField("new_password")}
          />
        </FormField>
        <FormField id="pw-confirm" label="Confirm new password" error={errors.new_password_confirm}>
          <input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            value={values.new_password_confirm}
            onChange={setField("new_password_confirm")}
          />
        </FormField>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function ProfilePage() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    toast.info("You have been logged out.");
    navigate("/login", { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Manage your account."
        actions={
          <button type="button" className="btn btn-outline" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        }
      />
      <div className="profile-layout">
        <ProfileDetails />
        <ChangePasswordForm />
      </div>
    </>
  );
}
