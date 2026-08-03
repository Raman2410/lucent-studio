import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Aperture } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useAuth } from "@/context/AuthContext";

/**
 * Register — field rules mirror server/src/models/User.model.js
 * exactly, so client-side errors match what the backend would say:
 *   - phone: /^[6-9]\d{9}$/ (10-digit Indian mobile)
 *   - password: minimum 8 characters
 */
export default function Register() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");

  const validate = () => {
    const errs = {};
    if (form.name.trim().length < 2) errs.name = "Enter your full name";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email address";
    if (!/^[6-9]\d{9}$/.test(form.phone)) errs.phone = "Enter a valid 10-digit mobile number";
    if (form.password.length < 8) errs.password = "Password must be at least 8 characters";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    try {
      await register(form);
      navigate("/", { replace: true });
    } catch (err) {
      setFormError(err.message || "Couldn't create your account. Please try again.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center py-16 px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <Aperture className="h-7 w-7 text-ink mb-4" strokeWidth={1.5} />
          <h1 className="font-display text-[28px] text-ink">Create your account</h1>
          <p className="text-sm text-mist mt-1.5">Book sessions and rent gear in a couple of clicks</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
          <FormField
            id="name"
            label="Full name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={fieldErrors.name}
          />
          <FormField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={fieldErrors.email}
          />
          <FormField
            id="phone"
            label="Mobile number"
            type="tel"
            autoComplete="tel"
            placeholder="9876543210"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            error={fieldErrors.phone}
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={fieldErrors.password}
          />

          {formError && (
            <p className="text-[13px] font-mono text-red-500/90 -mt-2">{formError}</p>
          )}

          <Button type="submit" variant="primary" size="lg" disabled={loading} className="mt-2">
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-mist mt-8">
          Already have an account?{" "}
          <Link to="/login" className="text-ink underline underline-offset-4 decoration-line-strong hover:decoration-signature hover:text-signature transition-colors">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
