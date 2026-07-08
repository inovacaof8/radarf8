import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface AreaOption {
  id: string;
  name: string;
  acronym?: string | null;
}

interface AreaComboboxProps {
  areas: AreaOption[] | undefined;
  value: string; // "none" or area id
  onChange: (value: string) => void;
  placeholder?: string;
  includeNone?: boolean;
  noneLabel?: string;
}

export function AreaCombobox({
  areas,
  value,
  onChange,
  placeholder = "Selecione a área...",
  includeNone = true,
  noneLabel = "— Sem área —",
}: AreaComboboxProps) {
  const [open, setOpen] = useState(false);

  // Sort alphabetically by acronym (when present) then name, using locale-aware sort.
  const sorted = useMemo(() => {
    const list = [...(areas ?? [])];
    return list.sort((a, b) => {
      const ka = (a.acronym || a.name || "").toString();
      const kb = (b.acronym || b.name || "").toString();
      return ka.localeCompare(kb, "pt-BR", { sensitivity: "base", numeric: true });
    });
  }, [areas]);

  const selected = sorted.find((a) => a.id === value);
  const label = value === "none" || !selected
    ? (includeNone ? noneLabel : placeholder)
    : `${selected.acronym ? selected.acronym + " — " : ""}${selected.name}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", (value === "none" || !selected) && "text-muted-foreground")}>
            {label}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(value, search) => {
            // value is the searchable string we set on each CommandItem
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por sigla ou nome..." />
          <CommandList>
            <CommandEmpty>Nenhuma área encontrada.</CommandEmpty>
            <CommandGroup>
              {includeNone && (
                <CommandItem
                  value="__none__ sem area nenhuma"
                  onSelect={() => {
                    onChange("none");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === "none" ? "opacity-100" : "opacity-0")} />
                  {noneLabel}
                </CommandItem>
              )}
              {sorted.map((a) => {
                const search = `${a.acronym ?? ""} ${a.name}`.trim();
                return (
                  <CommandItem
                    key={a.id}
                    value={`${search} ${a.id}`}
                    onSelect={() => {
                      onChange(a.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === a.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">
                      {a.acronym ? <span className="font-medium">{a.acronym}</span> : null}
                      {a.acronym ? <span className="text-muted-foreground"> — </span> : null}
                      {a.name}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
