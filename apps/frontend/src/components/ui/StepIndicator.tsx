import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between w-full">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-300",
                step.id < currentStep
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : step.id === currentStep
                  ? "bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-900/40"
                  : "bg-[#243154] border-[#2D3E5F] text-[#94A3B8]"
              )}
            >
              {step.id < currentStep ? (
                <Check className="w-4 h-4" />
              ) : (
                step.id
              )}
            </div>
            <span
              className={cn(
                "mt-2 text-xs whitespace-nowrap",
                step.id === currentStep
                  ? "text-indigo-400 font-medium"
                  : "text-[#94A3B8]"
              )}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "flex-1 h-0.5 mx-3 mb-5 rounded transition-all duration-500",
                step.id < currentStep ? "bg-indigo-600" : "bg-[#2D3E5F]"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
