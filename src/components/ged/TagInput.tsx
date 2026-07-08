import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ value, onChange, placeholder }: TagInputProps) {
  const propText = useMemo(() => value.join(", "), [value]);
  const [text, setText] = useState(propText);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(propText);
  }, [focused, propText]);

  function parse(raw: string) {
    return Array.from(new Set(raw.split(",").map((t) => t.trim()).filter(Boolean)));
  }

  function updateText(raw: string) {
    setText(raw);
    onChange(parse(raw));
  }

  function remove(t: string) {
    const next = value.filter((x) => x !== t);
    setText(next.join(", "));
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <Input
        value={text}
        onFocus={() => setFocused(true)}
        onChange={(e) => updateText(e.target.value)}
        onBlur={(e) => {
          setFocused(false);
          const next = parse(e.target.value);
          setText(next.join(", "));
          onChange(next);
        }}
        placeholder={placeholder ?? "Digite tags separadas por vírgula"}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1">
              {t}
              <button type="button" onClick={() => remove(t)} className="hover:text-destructive" aria-label={`Remover tag ${t}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
