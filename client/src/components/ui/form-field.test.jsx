import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormField } from "./form-field";
import { Select } from "./select";

describe("FormField", () => {
  it("renders a label wired to the input via htmlFor/id", () => {
    render(<FormField id="email" label="Email" value="" onChange={() => {}} />);
    const input = screen.getByLabelText("Email");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("renders a textarea when as='textarea'", () => {
    render(<FormField id="notes" label="Notes" as="textarea" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Notes").tagName).toBe("TEXTAREA");
  });

  it("shows an error message when error is set", () => {
    render(
      <FormField id="email" label="Email" error="Email is required" value="" onChange={() => {}} />
    );
    expect(screen.getByText("Email is required")).toBeInTheDocument();
  });

  it("shows no error text when error is not set", () => {
    render(<FormField id="email" label="Email" value="" onChange={() => {}} />);
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
  });

  it("forwards typing to onChange", async () => {
    const onChange = vi.fn();
    render(<FormField id="email" label="Email" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Email"), "a");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Select", () => {
  it("renders its option children", () => {
    render(
      <Select value="wedding" onChange={() => {}}>
        <option value="wedding">Wedding</option>
        <option value="portrait">Portrait</option>
      </Select>
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Wedding" }).selected).toBe(true);
  });

  it("fires onChange when a new option is picked", async () => {
    const onChange = vi.fn();
    render(
      <Select value="wedding" onChange={onChange}>
        <option value="wedding">Wedding</option>
        <option value="portrait">Portrait</option>
      </Select>
    );
    await userEvent.selectOptions(screen.getByRole("combobox"), "portrait");
    expect(onChange).toHaveBeenCalled();
  });
});
