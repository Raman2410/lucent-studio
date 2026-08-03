import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { KeyRound, ArrowRight, ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useAuth } from "@/context/AuthContext";

/**
 * ForgotPassword — POST /api/auth/forgot-password { email }
 *
 * The backend always responds with a generic "if an account exists…"
 * message regardless of whether the email is registered (prevents
 * enumeration), so this page always shows the same success state too —
 * there's nothing meaningful to branch on client-side.
 */
export default function ForgotPassword() {
  const { forgotPassword, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);

  const validate = () => {
    const valid = /^\S+@\S+\.\S+$/.test(email);
    setFieldError(valid ? "" : "Enter a valid email address");
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setFormError(err.message || "Something went wrong. Please try again.");
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
        {sent ? (
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-signature/10 flex items-center justify-center text-signature mb-4">
              <MailCheck className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-3xl text-ink font-normal">Check your email</h1>
            <p className="text-xs text-mist mt-1.5 font-light max-w-xs">
              If an account exists for <span className="text-ink font-medium">{email}</span>, we've
              sent a link to reset your password. It expires in 15 minutes.
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-8 rounded-full"
              onClick={() => setSent(false)}
            >
              Use a different email
            </Button>

            <p className="text-center text-xs text-mist mt-8 pt-6 border-t border-line w-full">
              <Link to="/login" className="text-signature font-medium hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Back to Sign In
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center text-center mb-8">
              <div className="h-12 w-12 rounded-full bg-signature/10 flex items-center justify-center text-signature mb-4">
                <KeyRound className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <h1 className="font-display text-3xl text-ink font-normal">Forgot Password</h1>
              <p className="text-xs text-mist mt-1.5 font-light">
                Enter your email and we'll send you a link to reset it
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              <FormField
                id="email"
                label="Email Address"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldError}
              />

              {formError && (
                <p className="text-xs font-mono text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
                  {formError}
                </p>
              )}

              <Button type="submit" variant="signature" size="lg" disabled={loading} className="mt-2 rounded-full w-full">
                {loading ? "Sending link…" : "Send Reset Link"} <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </form>

            <p className="text-center text-xs text-mist mt-8 pt-6 border-t border-line">
              <Link to="/login" className="text-signature font-medium hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Back to Sign In
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
