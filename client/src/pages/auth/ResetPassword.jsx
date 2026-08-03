import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useAuth } from "@/context/AuthContext";

// mirrors server/src/middlewares/validate.middleware.js -> fields.password
// so client-side errors match what the backend would reject
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;

/**
 * ResetPassword — PATCH /api/auth/reset-password/:token { newPassword, confirmPassword }
 * The :token param comes straight from the emailed link
 * (see auth.controller.js -> forgotPassword -> resetURL).
 */
export default function ResetPassword() {
  const { token } = useParams();
  const { resetPassword, loading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");

  const validate = () => {
    const errs = {};
    if (form.newPassword.length < 8 || !PASSWORD_PATTERN.test(form.newPassword)) {
      errs.newPassword =
        "At least 8 characters, with uppercase, lowercase, a number, and a special character";
    }
    if (form.confirmPassword !== form.newPassword) {
      errs.confirmPassword = "Passwords do not match";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    try {
      await resetPassword({ token, newPassword: form.newPassword, confirmPassword: form.confirmPassword });
      navigate("/", { replace: true });
    } catch (err) {
      setFormError(
        err.message || "This reset link is invalid or has expired. Please request a new one."
      );
    }
  };

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center py-16 px-6 bg-paper-dim/30">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md bg-paper border border-line rounded-2xl p-8 sm:p-10 shadow-card"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-12 w-12 rounded-full bg-signature/10 flex items-center justify-center text-signature mb-4">
            <ShieldCheck className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-3xl text-ink font-normal">Reset Password</h1>
          <p className="text-xs text-mist mt-1.5 font-light">Choose a new password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <FormField
            id="newPassword"
            label="New Password"
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            error={fieldErrors.newPassword}
          />
          <FormField
            id="confirmPassword"
            label="Confirm New Password"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            error={fieldErrors.confirmPassword}
          />

          {formError && (
            <p className="text-xs font-mono text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
              {formError}{" "}
              <Link to="/forgot-password" className="underline font-medium">
                Request a new link
              </Link>
            </p>
          )}

          <Button type="submit" variant="signature" size="lg" disabled={loading} className="mt-2 rounded-full w-full">
            {loading ? "Resetting…" : "Reset Password"} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </form>

        <p className="text-center text-xs text-mist mt-8 pt-6 border-t border-line">
          Remembered your password?{" "}
          <Link to="/login" className="text-signature font-medium hover:underline">
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
