import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const spinnerVariants = cva(
  "relative inline-flex items-center justify-center align-[-0.125em]",
  {
    variants: {
      size: {
        sm: "h-5 w-5",
        md: "h-10 w-10",
        lg: "h-16 w-16",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string;
}

export function Spinner({ size, className }: SpinnerProps) {
  return (
    <div
      className={cn(spinnerVariants({ size, className }))}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(124,194,66,0.28)_0%,_rgba(124,194,66,0.08)_42%,_rgba(124,194,66,0)_72%)] blur-md"
      />
      <img
        src="/gear-head.png"
        alt=""
        aria-hidden="true"
        className="relative z-10 h-full w-full animate-spin object-contain drop-shadow-[0_0_18px_rgba(124,194,66,0.32)] motion-reduce:animate-none"
        style={{ animationDuration: "1.6s" }}
      />
      <span
        className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
      >
        Loading...
      </span>
    </div>
  );
}
