import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Aperture, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/";

  const [form, setForm] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");

  const validate = () => {
    const errs = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email address";
    if (!form.password) errs.password = "Password is required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    try {
      await login(form.email, form.password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setFormError(err.message || "Couldn't sign in. Check your details and try again.");
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
            <Aperture className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-3xl text-ink font-normal">Welcome Back</h1>
          <p className="text-xs text-mist mt-1.5 font-light">
            Sign in to manage your session bookings and camera rentals
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <FormField
            id="email"
            label="Email Address"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={fieldErrors.email}
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={fieldErrors.password}
          />

          <Link
            to="/forgot-password"
            className="text-xs text-mist hover:text-signature transition-colors -mt-2 self-end"
          >
            Forgot password?
          </Link>

          {formError && (
            <p className="text-xs font-mono text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">{formError}</p>
          )}

          <Button type="submit" variant="signature" size="lg" disabled={loading} className="mt-2 rounded-full w-full">
            {loading ? "Signing in…" : "Sign In"} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </form>

        <p className="text-center text-xs text-mist mt-8 pt-6 border-t border-line">
          New to Lucent Studio?{" "}
          <Link to="/register" className="text-signature font-medium hover:underline">
            Create an Account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
