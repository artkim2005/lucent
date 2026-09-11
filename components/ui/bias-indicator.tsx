import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BiasIndicatorProps {
  leftPercentage: number;
  centerPercentage: number;
  rightPercentage: number;
  className?: string;
}

export function BiasIndicator({
  leftPercentage,
  centerPercentage,
  rightPercentage,
  className,
}: BiasIndicatorProps) {
  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="inline-flex items-center gap-1 rounded-full bg-bias-left/15 px-2.5 py-1 text-caption font-semibold text-bias-left">
        <ArrowLeft className="size-3" strokeWidth={1.6} />
        Left {leftPercentage}%
      </span>
      <span className="inline-flex items-center rounded-full bg-violet/15 px-2.5 py-1 text-caption font-semibold text-violet">
        Center {centerPercentage}%
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-red/15 px-2.5 py-1 text-caption font-semibold text-red">
        Right {rightPercentage}%
        <ArrowRight className="size-3" strokeWidth={1.6} />
      </span>
    </div>
  );
}
