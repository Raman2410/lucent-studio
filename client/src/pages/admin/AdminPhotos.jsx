import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  Star,
  Pencil,
  Trash2,
  Image as ImageIcon,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import photoService from "@/services/photoService";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { StatusBanner } from "@/components/ui/status-banner";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const CATEGORIES = ["wedding", "portrait", "commercial", "nature", "street"];

// ─────────────────────────────────────────
// UPLOAD MODAL — handles both single + bulk
// (bulk kicks in automatically once >1 file is picked)
// ─────────────────────────────────────────
function UploadModal({ open, onClose, onDone }) {
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const isBulk = files.length > 1;

  const reset = () => {
    setFiles([]);
    setCategory(CATEGORIES[0]);
    setTitle("");
    setDescription("");
    setTags("");
    setIsFeatured(false);
    setDisplayOrder(0);
    setError("");
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setError("Choose at least one photo.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (isBulk) {
        await photoService.uploadBulk({ files, category, startOrder: displayOrder });
      } else {
        await photoService.upload({
          file: files[0],
          category,
          title,
          description,
          tags,
          isFeatured,
          displayOrder,
        });
      }
      reset();
      onDone(`${files.length} photo${files.length > 1 ? "s" : ""} uploaded`);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Upload Photos">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed border-line-strong rounded-md py-8 px-4 text-center cursor-pointer hover:border-signature transition-colors"
        >
          <Upload className="h-5 w-5 text-mist mx-auto mb-2" />
          {files.length === 0 ? (
            <p className="text-[13px] text-mist">
              Click to choose photos <span className="text-mist-light">(up to 10)</span>
            </p>
          ) : (
            <p className="text-[13px] text-ink">{files.length} file{files.length > 1 ? "s" : ""} selected</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 10))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="upload-category" className="meta-caption">
            Category
          </label>
          <Select id="upload-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </Select>
        </div>

        {!isBulk && (
          <>
            <FormField
              label="Title"
              id="upload-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional"
            />
            <FormField
              as="textarea"
              label="Description"
              id="upload-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              rows={2}
            />
            <FormField
              label="Tags"
              id="upload-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="comma separated, e.g. mountain, sunset"
            />
            <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="accent-signature h-3.5 w-3.5"
              />
              Feature on homepage
            </label>
          </>
        )}

        <FormField
          label={isBulk ? "Starting display order" : "Display order"}
          id="upload-order"
          type="number"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
        />

        {error && <p className="text-[12.5px] text-red-500/90 font-mono">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────
// EDIT METADATA MODAL
// ─────────────────────────────────────────
function EditModal({ photo, onClose, onDone }) {
  const [title, setTitle] = useState(photo?.title || "");
  const [description, setDescription] = useState(photo?.description || "");
  const [category, setCategory] = useState(photo?.category || CATEGORIES[0]);
  const [tags, setTags] = useState((photo?.tags || []).join(", "));
  const [isFeatured, setIsFeatured] = useState(!!photo?.isFeatured);
  const [displayOrder, setDisplayOrder] = useState(photo?.displayOrder ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await photoService.update(photo._id, {
        title,
        description,
        category,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        isFeatured,
        displayOrder: Number(displayOrder) || 0,
      });
      onDone("Photo updated");
    } catch (err) {
      setError(err.message || "Update failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={!!photo} onClose={onClose} title="Edit Photo">
      {photo && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <img
            src={photo.url}
            alt={photo.title || "photo"}
            className="w-full h-40 object-cover rounded-md border border-line"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-category" className="meta-caption">
              Category
            </label>
            <Select id="edit-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <FormField label="Title" id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <FormField
            as="textarea"
            label="Description"
            id="edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <FormField label="Tags" id="edit-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          <FormField
            label="Display order"
            id="edit-order"
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
          />
          <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="accent-signature h-3.5 w-3.5"
            />
            Feature on homepage
          </label>
          {error && <p className="text-[12.5px] text-red-500/90 font-mono">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function AdminPhotos() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState(new Set());
  const [status, setStatus] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { ids: [] } | null
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (category !== "All") params.category = category;
      const res = await photoService.getAll(params);
      setPhotos(res.data || []);
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to load photos" });
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
    setSelected(new Set());
  }, [load]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDone = (message) => {
    setUploadOpen(false);
    setEditingPhoto(null);
    setStatus({ type: "success", message });
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.ids.length === 1) {
        await photoService.remove(deleteTarget.ids[0]);
      } else {
        await photoService.removeBulk(deleteTarget.ids);
      }
      setStatus({ type: "success", message: `${deleteTarget.ids.length} photo(s) deleted` });
      setDeleteTarget(null);
      setSelected(new Set());
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
        <h1 className="text-2xl font-display font-medium text-ink">Photos</h1>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="h-3.5 w-3.5" />
          Upload
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

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-line bg-paper-dim px-3.5 py-2">
          <span className="text-[13px] text-ink">{selected.size} selected</span>
          <button
            onClick={() => setDeleteTarget({ ids: Array.from(selected) })}
            className="flex items-center gap-1 text-[12.5px] text-red-600 hover:text-red-700 font-medium"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete selected
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-mist hover:text-ink">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonGrid
          count={10}
          cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          gap="gap-3"
          aspect="aspect-square"
        />
      ) : photos.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={`No photos ${category !== "All" ? `in ${category} ` : ""}yet`}
          description="Upload photos to build out the portfolio."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {photos.map((p) => {
            const isSelected = selected.has(p._id);
            return (
              <div
                key={p._id}
                className="group relative rounded-md overflow-hidden border border-line bg-paper-dim aspect-square"
              >
                <img
                  src={p.url}
                  alt={p.title || p.category}
                  className="w-full h-full object-cover"
                />

                <button
                  onClick={() => toggleSelect(p._id)}
                  className="absolute top-2 left-2 text-paper drop-shadow"
                >
                  {isSelected ? (
                    <CheckSquare className="h-4.5 w-4.5 fill-signature text-signature" />
                  ) : (
                    <Square className="h-4.5 w-4.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>

                {p.isFeatured && (
                  <Star className="absolute top-2 right-2 h-4 w-4 text-gold fill-gold drop-shadow" />
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-paper-dark/80 to-transparent p-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-[11px] text-white truncate mb-1.5">
                    {p.title || p.category}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditingPhoto(p)}
                      className="flex items-center justify-center h-6 w-6 rounded bg-paper/90 hover:bg-paper text-ink"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ ids: [p._id] })}
                      className="flex items-center justify-center h-6 w-6 rounded bg-paper/90 hover:bg-paper text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onDone={handleDone} />
      <EditModal photo={editingPhoto} onClose={() => setEditingPhoto(null)} onDone={handleDone} />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title={deleteTarget?.ids.length > 1 ? "Delete photos?" : "Delete photo?"}
        description={`This will permanently remove ${
          deleteTarget?.ids.length > 1 ? `${deleteTarget.ids.length} photos` : "this photo"
        } from storage. This can't be undone.`}
      />
    </div>
  );
}
