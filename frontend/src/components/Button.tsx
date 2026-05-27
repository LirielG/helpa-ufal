import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "navy";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  rounded?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      rounded = false,
      children,
      disabled,
      className = "",
      ...props
    },
    ref,
  ) => {
    const baseClasses = `${rounded ? "rounded-full" : "rounded-lg"} font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none`;

    const variants = {
      primary: "bg-blue-600 hover:bg-blue-700 text-white",
      secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800",
      danger: "bg-red-800 hover:bg-red-900 text-white",
      navy: "bg-[#072C59] hover:bg-[#072C59] text-white",
    };

    const sizes = {
      sm: "px-3 py-2 text-sm",
      md: "px-4 py-3 text-base",
      lg: "w-full py-4 text-lg",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading ? "Carregando..." : children}
      </button>
    );
  },
);

Button.displayName = "Button";
