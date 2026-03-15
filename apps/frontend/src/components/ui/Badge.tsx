import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "indigo" | "emerald" | "amber" | "rose" | "sky" | "gray";
  className?: string;
}

const variants = {
  indigo: "bg-indigo-900/40 text-indigo-300 border-indigo-600/40",
  emerald: "bg-emerald-900/40 text-emerald-300 border-emerald-600/40",
  amber: "bg-amber-900/40 text-amber-300 border-amber-600/40",
  rose: "bg-rose-900/40 text-rose-300 border-rose-600/40",
  sky: "bg-sky-900/40 text-sky-300 border-sky-600/40",
  gray: "bg-[#243154] text-[#94A3B8] border-[#2D3E5F]",
};

export function Badge({
  children,
  variant = "indigo",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
