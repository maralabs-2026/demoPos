import { cn } from "cn";

type CategoryTabsProps<T extends string> = {
  items: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onValueChange: (value: T) => void;
  label?: string;
  className?: string;
};

/** Selector de categoría tipo píldora (segmented control del UI kit). */
function CategoryTabs<T extends string>({
  items,
  value,
  onValueChange,
  label = "Categorías",
  className,
}: CategoryTabsProps<T>) {
  return (
    <div
      data-slot="category-tabs"
      role="group"
      aria-label={label}
      className={cn(
        "flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "h-8 shrink-0 rounded-full px-3.5 text-xs whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none",
              active
                ? "bg-foreground font-semibold text-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export { CategoryTabs };
