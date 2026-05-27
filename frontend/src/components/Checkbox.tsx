import React from "react";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  name?: string;
  id?: string;
  disabled?: boolean;
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, onChange, label, name, id, disabled }, ref) => {
    return (
      <label className="inline-flex cursor-pointer items-center gap-3">
        <input
          ref={ref}
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-[#072C59] focus:ring-2 focus:ring-[#072C59]/30"
        />
        {label ? <span className="text-sm text-gray-700">{label}</span> : null}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";