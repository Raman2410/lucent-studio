import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal, ConfirmDialog } from "./modal";

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        content
      </Modal>
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("renders title and children when open", () => {
    render(
      <Modal open onClose={() => {}} title="Edit Camera">
        <p>Form goes here</p>
      </Modal>
    );
    expect(screen.getByText("Edit Camera")).toBeInTheDocument();
    expect(screen.getByText("Form goes here")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Edit Camera">
        content
      </Modal>
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape key", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Edit Camera">
        content
      </Modal>
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmDialog", () => {
  it("shows the description and default confirm label", () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        description="This can't be undone."
      />
    );
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("calls onConfirm when confirm is clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open onClose={() => {}} onConfirm={onConfirm} confirmLabel="Remove" />
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons and shows a working label while loading", () => {
    render(
      <ConfirmDialog open onClose={() => {}} onConfirm={() => {}} loading />
    );
    expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
