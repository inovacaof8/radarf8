import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type PortfolioAreaOption = {
  id: string;
  name: string;
  acronym: string | null;
};

type PortfolioAreaPickerProps = {
  areas: PortfolioAreaOption[];
  value: string[];
  onChange: (areaIds: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
};

export default function PortfolioAreaPicker({
  areas,
  value,
  onChange,
  disabled,
  loading,
}: PortfolioAreaPickerProps) {
  const toggle = (areaId: string, checked: boolean) => {
    if (checked) {
      onChange(Array.from(new Set([...value, areaId])));
      return;
    }
    onChange(value.filter((id) => id !== areaId));
  };

  return (
    <div className="space-y-2">
      <Label>Áreas/departamentos com acesso</Label>
      <div className="rounded-md border bg-background max-h-48 overflow-auto p-2 space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground p-2">Carregando áreas...</p>
        ) : areas.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">
            Nenhuma área disponível para seu perfil. Peça a um administrador para vincular você como gestor de uma área.
          </p>
        ) : (
          areas.map((area) => (
            <label key={area.id} className="flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1 hover:bg-muted/60">
              <Checkbox
                checked={value.includes(area.id)}
                disabled={disabled}
                onCheckedChange={(checked) => toggle(area.id, checked === true)}
              />
              <span className="min-w-0 truncate">
                {area.name}{area.acronym ? ` (${area.acronym})` : ""}
              </span>
            </label>
          ))
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Usuários ativos vinculados às áreas selecionadas poderão visualizar o portfólio, programas, projetos, cronogramas e documentos relacionados.
      </p>
    </div>
  );
}