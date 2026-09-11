"use client";

import { type InputHTMLAttributes, forwardRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className="inline-flex items-center gap-2 text-body-s text-text select-none"
      >
        <span className="relative inline-flex size-4 shrink-0">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            className={cn(
              "peer size-4 shrink-0 appearance-none rounded-sm border border-subtle bg-transparent checked:border-violet checked:bg-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-base disabled:opacity-50",
              className,
            )}
            {...props}
          />
          <Check
            className="pointer-events-none absolute inset-0 size-4 scale-75 text-base opacity-0 peer-checked:scale-100 peer-checked:opacity-100"
            strokeWidth={2.5}
          />
        </span>
        {label}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
