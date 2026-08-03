import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { MailCheck, MailWarning, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

/**
 * VerifyEmail — GET /api/auth/verify-email/:token
 * The :token param comes straight from the emailed link
 * (see auth.controller.js -> register/resendVerification -> verifyURL).
 */
export default function VerifyEmail() {
  const { token } = useParams();
  const { verifyEmail } = useAuth();

  const [state, setState] = useState("checking"); // checking | success | error
  const [errorMessage, setErrorMessage] = useState("");
  const ranOnce = useRef(false);

  useEffect(() => {
    // guard against React StrictMode's double-invoke in dev, which would
    // burn the (single-use) token on the harmless-looking second call
    if (ranOnce.current) return;
    ranOnce.current = true;

    verifyEmail(token)
      .then(() => setState("success"))
      .catch((err) => {
        setState("error");
        setErrorMessage(
          err.message || "This verification link is invalid or has expired."
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center py-16 px-6 bg-paper-dim/30">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md bg-paper border border-line rounded-2xl p-8 sm:p-10 shadow-card text-center"
      >
        {state === "checking" && (
          <>
            <div className="h-12 w-12 mx-auto rounded-full bg-signature/10 flex items-center justify-center text-signature mb-4">
              <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-3xl text-ink font-normal">Verifying…</h1>
            <p className="text-xs text-mist mt-1.5 font-light">
              Confirming your email address
            </p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="h-12 w-12 mx-auto rounded-full bg-signature/10 flex items-center justify-center text-signature mb-4">
              <MailCheck className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-3xl text-ink font-normal">Email Verified 🎉</h1>
            <p className="text-sm text-mist mt-3 font-light">
              Your email address has been confirmed. You're all set.
            </p>
            <Button asChild variant="signature" size="lg" className="mt-8 rounded-full w-full">
              <Link to="/">Back to Home</Link>
            </Button>
          </>
        )}

        {state === "error" && (
          <>
            <div className="h-12 w-12 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-600 mb-4">
              <MailWarning className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-3xl text-ink font-normal">Verification Failed</h1>
            <p className="text-xs font-mono text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg mt-4">
              {errorMessage}
            </p>
            <p className="text-xs text-mist mt-6">
              You can request a new link from your{" "}
              <Link to="/account" className="text-signature font-medium hover:underline">
                Account page
              </Link>{" "}
              once logged in.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
