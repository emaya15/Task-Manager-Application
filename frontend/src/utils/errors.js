/**
 * Turns an Axios error into something the UI can show.
 *
 * The API returns validation errors as
 *   { detail: "Validation failed.", errors: { field: ["msg", ...] } }
 * and other errors as { detail: "..." }.
 *
 * @returns {{ message: string, fieldErrors: Record<string, string> }}
 */
export function parseApiError(error, fallback = "Something went wrong. Please try again.") {
  const response = error?.response;
  if (!response) {
    return {
      message: error?.request
        ? "Cannot reach the server. Check your connection and that the API is running."
        : error?.message || fallback,
      fieldErrors: {},
    };
  }

  const data = response.data;
  const fieldErrors = {};
  let message = "";

  if (data && typeof data === "object") {
    const errors = data.errors && typeof data.errors === "object" ? data.errors : null;
    if (errors) {
      Object.entries(errors).forEach(([field, value]) => {
        const text = Array.isArray(value) ? value.join(" ") : String(value);
        if (field === "non_field_errors") message = text;
        else fieldErrors[field] = text;
      });
    }
    if (!message && typeof data.detail === "string" && !(errors && data.detail === "Validation failed.")) {
      message = data.detail;
    }
  }

  if (!message) {
    if (Object.keys(fieldErrors).length) message = "Please fix the highlighted fields.";
    else if (response.status === 404) message = "The requested item was not found.";
    else if (response.status >= 500) message = "The server had a problem. Please try again later.";
    else message = fallback;
  }

  return { message, fieldErrors };
}
