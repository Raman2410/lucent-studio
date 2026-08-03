import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Camera as CameraIcon,
  Power,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import cameraService from "@/services/cameraService";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { StatusBanner } from "@/components/ui/status-banner";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const BODY_TYPES = ["DSLR", "Mirrorless", "Point & Shoot", "Medium Format", "Film"];

const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const EMPTY_FORM = {
  name: "",
  brand: "",
  model: "",
  description: "",
  sensorType: "",
  megapixels: "",
  videoResolution: "",
  isoRange: "",
  autofocusPoints: "",
  batteryLife: "",
  bodyType: BODY_TYPES[1],
  mountType: "",
  hourlyRate: "",
  dailyRate: "",
  weekendRate: "",
  photographerAddonAvailable: true,
  photographerChargePerHour: "500",
  securityDeposit: "5000",
  idProofRequired: true,
  rentalNotes: "",
  displayOrder: "0",
};

const toFormState = (c) =>
  c
    ? {
        name: c.name || "",
        brand: c.brand || "",
        model: c.model || "",
        description: c.description || "",
        sensorType: c.specs?.sensorType || "",
        megapixels: c.specs?.megapixels ?? "",
        videoResolution: c.specs?.videoResolution || "",
        isoRange: c.specs?.isoRange || "",
        autofocusPoints: c.specs?.autofocusPoints ?? "",
        batteryLife: c.specs?.batteryLife || "",
        bodyType: c.specs?.bodyType || BODY_TYPES[1],
        mountType: c.specs?.mountType || "",
        hourlyRate: c.rentalRates?.hourly ?? "",
        dailyRate: c.rentalRates?.daily ?? "",
        weekendRate: c.rentalRates?.weekend ?? "",
        photographerAddonAvailable: c.photographerAddon?.available ?? true,
        photographerChargePerHour: c.photographerAddon?.chargePerHour ?? 500,
        securityDeposit: c.rentalTerms?.securityDeposit ?? 5000,
        idProofRequired: c.rentalTerms?.idProofRequired ?? true,
        rentalNotes: c.rentalTerms?.notes || "",
        displayOrder: c.displayOrder ?? 0,
      }
    : EMPTY_FORM;

// ─────────────────────────────────────────
// CREATE / EDIT MODAL
// ─────────────────────────────────────────
function CameraModal({ open, camera, onClose, onDone }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [image, setImage] = useState(null);
  const [accessories, setAccessories] = useState([]); // [{ name, description, additionalCharge, image }]
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!camera;

  useEffect(() => {
    if (open) {
      setForm(toFormState(camera));
      setImage(null);
      setAccessories([]);
      setError("");
    }
  }, [open, camera]);

  const set = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e?.target?.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const addAccessory = () =>
    setAccessories((a) => [...a, { name: "", description: "", additionalCharge: 0, image: null }]);

  const updateAccessory = (idx, patch) =>
    setAccessories((a) => a.map((acc, i) => (i === idx ? { ...acc, ...patch } : acc)));

  const removeAccessory = (idx) => setAccessories((a) => a.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !image) {
      setError("A camera image is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (isEdit) {
        await cameraService.update(camera._id, {
          name: form.name,
          brand: form.brand,
          model: form.model,
          description: form.description,
          specs: {
            sensorType: form.sensorType,
            megapixels: form.megapixels === "" ? null : Number(form.megapixels),
            videoResolution: form.videoResolution,
            isoRange: form.isoRange,
            autofocusPoints: form.autofocusPoints === "" ? null : Number(form.autofocusPoints),
            batteryLife: form.batteryLife,
            bodyType: form.bodyType,
            mountType: form.mountType,
          },
          rentalRates: {
            hourly: Number(form.hourlyRate) || 0,
            daily: Number(form.dailyRate) || 0,
            weekend: Number(form.weekendRate) || 0,
          },
          photographerAddon: {
            available: form.photographerAddonAvailable,
            chargePerHour: Number(form.photographerChargePerHour) || 0,
          },
          rentalTerms: {
            securityDeposit: Number(form.securityDeposit) || 0,
            idProofRequired: form.idProofRequired,
            notes: form.rentalNotes,
          },
          displayOrder: Number(form.displayOrder) || 0,
        });
        onDone("Camera updated");
      } else {
        await cameraService.create({
          ...form,
          image,
          accessories: accessories.length ? accessories : undefined,
          accessoryImages: accessories.map((a) => a.image),
        });
        onDone("Camera added");
      }
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Camera" : "New Camera"} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid sm:grid-cols-3 gap-5">
          <FormField label="Name" id="cam-name" value={form.name} onChange={set("name")} required />
          <FormField label="Brand" id="cam-brand" value={form.brand} onChange={set("brand")} required />
          <FormField label="Model" id="cam-model" value={form.model} onChange={set("model")} required />
        </div>

        <FormField
          as="textarea"
          label="Description"
          id="cam-description"
          value={form.description}
          onChange={set("description")}
          rows={2}
        />

        {!isEdit && (
          <div className="flex flex-col gap-1.5">
            <label className="meta-caption">Camera image</label>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(e) => setImage(e.target.files?.[0] || null)}
              className="text-[13px] text-ink file:mr-3 file:px-3 file:py-1.5 file:rounded-[2px] file:border file:border-line file:bg-transparent file:text-[12px] file:cursor-pointer"
            />
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-[11px] font-mono uppercase tracking-wide text-mist">Specs</h3>
          <div className="grid sm:grid-cols-2 gap-5">
            <FormField label="Sensor type" id="cam-sensor" value={form.sensorType} onChange={set("sensorType")} placeholder="Full Frame" />
            <FormField label="Megapixels" id="cam-mp" type="number" value={form.megapixels} onChange={set("megapixels")} />
            <FormField label="Video resolution" id="cam-video" value={form.videoResolution} onChange={set("videoResolution")} placeholder="4K 30fps" />
            <FormField label="ISO range" id="cam-iso" value={form.isoRange} onChange={set("isoRange")} placeholder="100-51200" />
            <FormField label="AF points" id="cam-af" type="number" value={form.autofocusPoints} onChange={set("autofocusPoints")} />
            <FormField label="Battery life" id="cam-battery" value={form.batteryLife} onChange={set("batteryLife")} placeholder="~610 shots" />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cam-body-type" className="meta-caption">Body type</label>
              <Select id="cam-body-type" value={form.bodyType} onChange={set("bodyType")}>
                {BODY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <FormField label="Mount type" id="cam-mount" value={form.mountType} onChange={set("mountType")} placeholder="Sony E-Mount" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-[11px] font-mono uppercase tracking-wide text-mist">Rental rates (₹)</h3>
          <div className="grid sm:grid-cols-3 gap-5">
            <FormField label="Hourly" id="cam-hourly" type="number" value={form.hourlyRate} onChange={set("hourlyRate")} required />
            <FormField label="Daily" id="cam-daily" type="number" value={form.dailyRate} onChange={set("dailyRate")} required />
            <FormField label="Weekend" id="cam-weekend" type="number" value={form.weekendRate} onChange={set("weekendRate")} required />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-[11px] font-mono uppercase tracking-wide text-mist">Photographer add-on & terms</h3>
          <div className="grid sm:grid-cols-3 gap-5">
            <FormField
              label="Charge / hour (₹)"
              id="cam-photog-charge"
              type="number"
              value={form.photographerChargePerHour}
              onChange={set("photographerChargePerHour")}
            />
            <FormField
              label="Security deposit (₹)"
              id="cam-deposit"
              type="number"
              value={form.securityDeposit}
              onChange={set("securityDeposit")}
            />
            <FormField
              label="Display order"
              id="cam-order"
              type="number"
              value={form.displayOrder}
              onChange={set("displayOrder")}
            />
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
              <input type="checkbox" checked={form.photographerAddonAvailable} onChange={set("photographerAddonAvailable")} className="accent-signature h-3.5 w-3.5" />
              Photographer add-on available
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
              <input type="checkbox" checked={form.idProofRequired} onChange={set("idProofRequired")} className="accent-signature h-3.5 w-3.5" />
              ID proof required
            </label>
          </div>
          <FormField
            as="textarea"
            label="Rental notes"
            id="cam-notes"
            value={form.rentalNotes}
            onChange={set("rentalNotes")}
            rows={2}
          />
        </div>

        {!isEdit && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-mono uppercase tracking-wide text-mist">
                Accessories <span className="text-mist-light">(optional)</span>
              </h3>
              <button type="button" onClick={addAccessory} className="text-[12px] text-signature hover:underline">
                + Add accessory
              </button>
            </div>
            {accessories.map((acc, idx) => (
              <div key={idx} className="rounded-md border border-line p-3 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => removeAccessory(idx)}
                  className="absolute top-2 right-2 text-mist hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="grid sm:grid-cols-2 gap-3">
                  <FormField
                    label="Name"
                    id={`acc-name-${idx}`}
                    value={acc.name}
                    onChange={(e) => updateAccessory(idx, { name: e.target.value })}
                  />
                  <FormField
                    label="Extra charge (₹)"
                    id={`acc-charge-${idx}`}
                    type="number"
                    value={acc.additionalCharge}
                    onChange={(e) => updateAccessory(idx, { additionalCharge: e.target.value })}
                  />
                </div>
                <FormField
                  label="Description"
                  id={`acc-desc-${idx}`}
                  value={acc.description}
                  onChange={(e) => updateAccessory(idx, { description: e.target.value })}
                />
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(e) => updateAccessory(idx, { image: e.target.files?.[0] || null })}
                  className="text-[12.5px] text-ink file:mr-3 file:px-2.5 file:py-1 file:rounded-[2px] file:border file:border-line file:bg-transparent file:text-[11.5px] file:cursor-pointer"
                />
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-[12.5px] text-red-500/90 font-mono">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1 sticky bottom-0 bg-paper">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Add camera"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function AdminCameras() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCam, setEditingCam] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cameraService.getAll({ limit: 100 });
      setCameras(res.data || []);
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to load cameras" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDone = (message) => {
    setModalOpen(false);
    setEditingCam(null);
    setStatus({ type: "success", message });
    load();
  };

  const openCreate = () => {
    setEditingCam(null);
    setModalOpen(true);
  };

  const openEdit = (cam) => {
    setEditingCam(cam);
    setModalOpen(true);
  };

  const toggleAvailability = async (cam) => {
    setTogglingId(cam._id);
    try {
      await cameraService.toggleAvailability(cam._id);
      setStatus({
        type: "success",
        message: `${cam.name} marked ${cam.isAvailable ? "unavailable" : "available"}`,
      });
      load();
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to update availability" });
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await cameraService.remove(deleteTarget._id);
      setStatus({ type: "success", message: "Camera deleted" });
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
        <h1 className="text-2xl font-display font-medium text-ink">Cameras</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          New Camera
        </Button>
      </div>

      {status && <StatusBanner status={status} onDismiss={() => setStatus(null)} />}

      {loading ? (
        <SkeletonGrid count={6} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" gap="gap-4" aspect="aspect-[4/3]" />
      ) : cameras.length === 0 ? (
        <EmptyState
          icon={CameraIcon}
          title="No cameras yet"
          description="Add a camera to make it available for rental bookings."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              New Camera
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((c) => (
            <div key={c._id} className="rounded-lg border border-line bg-paper shadow-subtle overflow-hidden flex flex-col">
              <div className="aspect-video bg-paper-dim">
                {c.image?.url ? (
                  <img src={c.image.url} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <CameraIcon className="h-6 w-6 text-mist-light" />
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink truncate">
                      {c.brand} {c.name}
                    </div>
                    <div className="text-[11px] text-mist font-mono">{c.model}</div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono border",
                      c.isAvailable
                        ? "bg-signature-tint text-signature border-signature/25"
                        : "bg-red-50 text-red-600 border-red-200"
                    )}
                  >
                    {c.isAvailable ? "Available" : "Down"}
                  </span>
                </div>
                <div className="text-[11px] text-mist font-mono">
                  {money(c.rentalRates?.hourly)}/hr · {money(c.rentalRates?.daily)}/day
                </div>
                <div className="mt-auto flex items-center gap-1.5 pt-2">
                  <button
                    onClick={() => toggleAvailability(c)}
                    disabled={togglingId === c._id}
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md border border-line text-[12px] text-mist hover:text-ink hover:border-line-strong transition-colors disabled:opacity-40"
                  >
                    <Power className="h-3 w-3" />
                    {c.isAvailable ? "Mark down" : "Mark up"}
                  </button>
                  <button
                    onClick={() => openEdit(c)}
                    className="flex items-center justify-center h-8 w-8 rounded-md border border-line text-mist hover:text-ink hover:border-line-strong transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(c)}
                    className="flex items-center justify-center h-8 w-8 rounded-md border border-line text-mist hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CameraModal
        open={modalOpen}
        camera={editingCam}
        onClose={() => setModalOpen(false)}
        onDone={handleDone}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete camera?"
        description={`"${deleteTarget?.brand} ${deleteTarget?.name}" and its images will be permanently removed.`}
      />
    </div>
  );
}
