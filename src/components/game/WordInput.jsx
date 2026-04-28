import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function WordInput({ onSubmit, disabled }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim().toLocaleLowerCase("pl-PL");
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Wpisz słowo..."
        disabled={disabled}
        className="h-11 text-base"
      />
      <Button
        type="submit"
        disabled={disabled || !value.trim()}
        className="h-11 px-5 shrink-0"
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Dodaj
      </Button>
    </form>
  );
}
