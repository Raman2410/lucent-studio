import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Star, Package as PackageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import packageService from "@/services/packageService";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { StatusBanner } from "@/components/ui/status-banner";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const CATEGORIES = ["wedding", "portrait", "commercial", "nature", "street"];
const TYPES = ["fixed", "custom", "hourly"];
const DURATION_UNITS = ["hours", "days", "sessions"];

const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const EMPTY_FORM = {
  name: "",
  tagline: "",
  category: CATEGORIES[0],
  type: TYPES[0],
  priceAmount: "",
  priceUnit: "per session",
  description: "",
  includes: "",
  excludes: "",
  durationValue: "",
  durationUnit: "hours",
  editedPhotos: "",
  videos: "0",
  onlineGallery: true,
  printableFiles: false,
  turnaroundDays: "14",
  isPopular: false,
  displayOrder: "0",
};

const toFormState = (pkg) =>
  pkg
    ? {
        name: pkg.name || "",
        tagline: pkg.tagline || "",
        category: pkg.category || CATEGORIES[0],
        type: pkg.type || TYPES[0],
        priceAmount: pkg.price?.amount ?? "",
        priceUnit: pkg.price?.unit || "per session",
        description: pkg.description || "",
        includes: (pkg.includes || []).join("\n"),
        excludes: (pkg.excludes || []).join("\n"),
        durationValue: pkg.duration?.value ?? "",
        durationUnit: pkg.duration?.unit || "hours",
        editedPhotos: pkg.deliverables?.editedPhotos ?? "",
        videos: pkg.deliverables?.videos ?? 0,
        onlineGallery: pkg.deliverables?.onlineGallery ?? true,
        printableFiles: pkg.deliverables?.printableFiles ?? false,
        turnaroundDays: pkg.deliverables?.turnaroundDays ?? 14,
        isPopular: !!pkg.isPopular,
        displayOrder: pkg.displayOrder ?? 0,
      }
    : EMPTY_FORM;

const toPayload = (f) => ({
  name: f.name,
  tagline: f.tagline,
  category: f.category,
  type: f.type,
  price: {
    amount: Number(f.priceAmount) || 0,
    unit: f.priceUnit,
  },
  description: f.description,
  includes: f.includes
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean),
  excludes: f.excludes
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean),
  duration: {
    value: f.durationValue === "" ? null : Number(f.durationValue),
    unit: f.durationUnit,
  },
  deliverables: {
    editedPhotos: f.editedPhotos === "" ? null : Number(f.editedPhotos),
    videos: Number(f.videos) || 0,
    onlineGallery: f.onlineGallery,
    printableFiles: f.printableFiles,
    turnaroundDays: Number(f.turnaroundDays) || 14,
  },
  isPopular: f.isPopular,
  displayOrder: Number(f.displayOrder) || 0,
});

// ─────────────────────────────────────────
// CREATE / EDIT MODAL
// ─────────────────────────────────────────
function PackageModal({ open, pkg, onClose, onDone }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(toFormState(pkg));
      setError("");
    }
  }, [open, pkg]);

  const set = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e?.target?.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = toPayload(form);
      if (pkg) {
        await packageService.update(pkg._id, payload);
        onDone("Package updated");
      } else {
        await packageService.create(payload);
        onDone("Package created");
      }
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={pkg ? "Edit Package" : "New Package"} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-5">
          <FormField label="Name" id="pkg-name" value={form.name} onChange={set("name")} required />
          <FormField label="Tagline" id="pkg-tagline" value={form.tagline} onChange={set("tagline")} />
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pkg-category" className="meta-caption">Category</label>
            <Select id="pkg-category" value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pkg-type" className="meta-caption">Type</label>
            <Select id="pkg-type" value={form.type} onChange={set("type")}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
              ))}
            </Select>
          </div>
          <FormField
            label="Display order"
            id="pkg-order"
            type="number"
            value={form.displayOrder}
            onChange={set("displayOrder")}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <FormField
            label="Price amount (₹)"
            id="pkg-price"
            type="number"
            value={form.priceAmount}
            onChange={set("priceAmount")}
            required
          />
          <FormField
            label="Price unit"
            id="pkg-price-unit"
            value={form.priceUnit}
            onChange={set("priceUnit")}
            placeholder="e.g. per session, per hour, starting from"
          />
        </div>

        <FormField
          as="textarea"
          label="Description"
          id="pkg-description"
          value={form.description}
          onChange={set("description")}
          rows={3}
          required
        />

        <div className="grid sm:grid-cols-2 gap-5">
          <FormField
            as="textarea"
            label="Includes (one per line)"
            id="pkg-includes"
            value={form.includes}
            onChange={set("includes")}
            rows={4}
            placeholder={"8 hours coverage\n500 edited photos\nOnline gallery"}
          />
          <FormField
            as="textarea"
            label="Excludes (one per line)"
            id="pkg-excludes"
            value={form.excludes}
            onChange={set("excludes")}
            rows={4}
            placeholder="Optional"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <FormField
            label="Duration"
            id="pkg-duration-value"
            type="number"
            value={form.durationValue}
            onChange={set("durationValue")}
            placeholder="Leave blank for custom"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pkg-duration-unit" className="meta-caption">Duration unit</label>
            <Select id="pkg-duration-unit" value={form.durationUnit} onChange={set("durationUnit")}>
              {DURATION_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          <FormField
            label="Edited photos"
            id="pkg-edited-photos"
            type="number"
            value={form.editedPhotos}
            onChange={set("editedPhotos")}
          />
          <FormField label="Videos" id="pkg-videos" type="number" value={form.videos} onChange={set("videos")} />
          <FormField
            label="Turnaround (days)"
            id="pkg-turnaround"
            type="number"
            value={form.turnaroundDays}
            onChange={set("turnaroundDays")}
          />
        </div>

        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
            <input type="checkbox" checked={form.onlineGallery} onChange={set("onlineGallery")} className="accent-signature h-3.5 w-3.5" />
            Online gallery
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
            <input type="checkbox" checked={form.printableFiles} onChange={set("printableFiles")} className="accent-signature h-3.5 w-3.5" />
            Printable files
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
            <input type="checkbox" checked={form.isPopular} onChange={set("isPopular")} className="accent-signature h-3.5 w-3.5" />
            Mark as "Most Popular"
          </label>
        </div>

        {error && <p className="text-[12.5px] text-red-500/90 font-mono">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1 sticky bottom-0 bg-paper">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? "Saving…" : pkg ? "Save changes" : "Create package"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function AdminPackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (category !== "All") params.category = category;
      const res = await packageService.getAll(params);
      setPackages(res.data || []);
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to load packages" });
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDone = (message) => {
    setModalOpen(false);
    setEditingPkg(null);
    setStatus({ type: "success", message });
    load();
  };

  const openCreate = () => {
    setEditingPkg(null);
    setModalOpen(true);
  };

  const openEdit = (pkg) => {
    setEditingPkg(pkg);
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await packageService.remove(deleteTarget._id);
      setStatus({ type: "success", message: "Package deleted" });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Delete failed" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container-page py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-medium text-ink">Packages</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          New Package
        </Button>
      </div>

      {status && <StatusBanner status={status} onDismiss={() => setStatus(null)} />}

      <div className="flex items-center gap-1 flex-wrap">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors capitalize",
              category === c
                ? "bg-signature text-paper border-signature"
                : "border-line text-mist hover:text-ink"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : packages.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title={`No packages ${category !== "All" ? `in ${category} ` : ""}yet`}
          description="Create a package to start offering it to clients."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              New Package
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-line bg-paper shadow-subtle overflow-hidden">
          <div className="divide-y divide-line">
            {packages.map((p) => (
              <div key={p._id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink truncate">{p.name}</span>
                    {p.isPopular && <Star className="h-3.5 w-3.5 text-gold fill-gold shrink-0" />}
                  </div>
                  <div className="text-[11px] text-mist font-mono mt-0.5 capitalize">
                    {p.category} · {p.type}
                  </div>
                </div>
                <div className="shrink-0 text-right w-32">
                  <div className="text-sm font-mono text-ink">{money(p.price?.amount)}</div>
                  <div className="text-[11px] text-mist">{p.price?.unit}</div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    onClick={() => openEdit(p)}
                    className="flex items-center justify-center h-8 w-8 rounded-md border border-line text-mist hover:text-ink hover:border-line-strong transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(p)}
                    className="flex items-center justify-center h-8 w-8 rounded-md border border-line text-mist hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <PackageModal
        open={modalOpen}
        pkg={editingPkg}
        onClose={() => setModalOpen(false)}
        onDone={handleDone}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete package?"
        description={`"${deleteTarget?.name}" will be hidden from the site. Existing bookings referencing it stay valid.`}
      />
    </div>
  );
}
