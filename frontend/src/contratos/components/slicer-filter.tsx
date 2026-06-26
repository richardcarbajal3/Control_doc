import { FilterX } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlicerFilterProps {
  label?: string;
  options: string[];
  selected: string[];
  onSelectionChange: (next: string[]) => void;
  className?: string;
}

export function SlicerFilter({ label, options, selected, onSelectionChange, className }: SlicerFilterProps) {
  const handleClick = (value: string, e: React.MouseEvent) => {
    const isMulti = e.ctrlKey || e.metaKey;

    if (isMulti) {
      // Ctrl/Cmd+Click: toggle in/out of selection
      if (selected.includes(value)) {
        onSelectionChange(selected.filter(v => v !== value));
      } else {
        onSelectionChange([...selected, value]);
      }
    } else {
      // Plain click: select only this one, or deselect if already sole selection
      if (selected.length === 1 && selected[0] === value) {
        onSelectionChange([]);
      } else {
        onSelectionChange([value]);
      }
    }
  };

  return (
    <div className={cn("flex items-center gap-1.5 bg-card border p-1.5 rounded-lg shadow-sm flex-wrap", className)}>
      {label && (
        <span className="text-xs font-medium text-muted-foreground ml-1 mr-0.5">{label}</span>
      )}
      {options.map(option => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            onClick={(e) => handleClick(option, e)}
            aria-pressed={isSelected}
            className={cn(
              "inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors border cursor-pointer whitespace-nowrap",
              isSelected
                ? "bg-primary/15 border-primary text-primary font-semibold shadow-sm"
                : "bg-background border-transparent hover:bg-muted text-foreground"
            )}
          >
            {option}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          onClick={() => onSelectionChange([])}
          aria-label="Limpiar filtros"
          className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <FilterX className="h-3.5 w-3.5" />
        </button>
      )}
      {options.length > 1 && selected.length === 0 && (
        <span className="text-[10px] text-muted-foreground italic ml-1">
          Ctrl+click multi-selección
        </span>
      )}
    </div>
  );
}
