import { useState } from "react";
import { motion } from "motion/react";
import { KeyRound, ShieldCheck, User as UserIcon, MailWarning, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { StatusBanner } from "@/components/ui/status-banner";
import { useAuth } from "@/context/AuthContext";

// mirrors server/src/middlewares/validate.middleware.js -> fields.password
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;

/**
 * Account — settings page for the logged-in user.
 * Email verification nudge (GET /api/auth/resend-verification) + Change
 * Password (PATCH /api/auth/change-password), matching auth.controller.js.
 */
export default function Account() {
  const { user, changePassword, resendVerification, loading } = useAuth();

  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState(null); // { type: "success" | "error", message }

  const [resendState, setResendState] = useState("idle"); // idle | sending | sent | error

  const handleResend = async () => {
    setResendState("sending");
    try {
      await resendVerification();
      setResendState("sent");
    } catch {
      setResendState("error");
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.currentPassword) errs.currentPassword = "Enter your current password";
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
    setStatus(null);
    if (!validate()) return;
    try {
      await changePassword(form);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setFieldErrors({});
      setStatus({ type: "success", message: "Password changed successfully." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Couldn't change your password." });
    }
  };

  return (
    <div className="container-page py-16 sm:py-20 max-w-2xl">
      <div className="flex items-center gap-2 mb-2">
        <UserIcon className="h-4 w-4 text-signature" />
        <p className="meta-caption text-signature">Account Settings</p>
      </div>
      <h1 className="font-display text-3xl sm:text-4xl text-ink font-normal tracking-tight mb-1">
        {user?.name || "Your Account"}
      </h1>
      <p className="text-sm text-mist mb-10">{user?.email}</p>

      {user && !user.isEmailVerified && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6 mb-6"
        >
          <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
            <MailWarning className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-medium text-amber-900">Verify your email</h2>
            <p className="text-xs text-amber-800 mt-0.5">
              We sent a link to <strong>{user.email}</strong> when you signed up. Verify it so we
              can reliably reach you about bookings.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resendState === "sending" || resendState === "sent"}
                onClick={handleResend}
                className="rounded-full border-amber-300 text-amber-900 hover:bg-amber-100"
              >
                {resendState === "sending" ? "Sending…" : resendState === "sent" ? "Sent ✓" : "Resend link"}
              </Button>
              {resendState === "error" && (
                <span className="text-xs text-red-600">Couldn't send it — try again shortly.</span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {user?.isEmailVerified && (
        <div className="flex items-center gap-2 text-xs text-signature mb-6">
          <MailCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
          Email verified
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="bg-paper border border-line rounded-2xl p-6 sm:p-8"
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div className="h-9 w-9 rounded-full bg-signature/10 flex items-center justify-center text-signature shrink-0">
            <KeyRound className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-sm font-medium text-ink">Change Password</h2>
            <p className="text-xs text-mist">Update the password you use to sign in</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <FormField
            id="currentPassword"
            label="Current Password"
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            error={fieldErrors.currentPassword}
          />
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

          <StatusBanner status={status} onDismiss={() => setStatus(null)} />

          <Button type="submit" variant="signature" size="lg" disabled={loading} className="mt-1 rounded-full self-start px-8">
            {loading ? "Updating…" : "Update Password"} <ShieldCheck className="ml-1.5 h-4 w-4" />
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
