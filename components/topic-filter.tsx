import { cn } from "@/lib/utils";

export interface TopicFilterProps {
  categories: string[];
  activeCategory?: string;
}

export function TopicFilter({ categories, activeCategory }: TopicFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((category) => (
        <span
          key={category}
          className={cn(
            "shrink-0 select-none whitespace-nowrap rounded-full border px-3.5 py-1.5 text-body-s font-medium",
            category === activeCategory
              ? "border-violet/40 bg-violet/15 text-violet"
              : "border-elevated bg-surface text-subtle",
          )}
        >
          {category}
        </span>
      ))}
    </div>
  );
}
