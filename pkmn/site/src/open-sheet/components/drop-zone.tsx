import { useState, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClass } from "@/components/controls";
import { messageWidth } from "@/components/page";

export function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);

  function drop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setOver(false);
    onFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn(
        messageWidth,
        "flex flex-col items-center gap-4.5 rounded-2xl border-3 border-dashed bg-card px-6 py-16 text-center transition-colors",
        over && "border-primary",
      )}
    >
      <div className="grid size-16 place-items-center rounded-2xl bg-box text-foreground">
        <Upload className="size-7.5" aria-hidden="true" />
      </div>
      <span className="font-heading text-3xl">Drop an export here</span>
      <label className={cn(buttonClass, "relative focus-within:ring-3 focus-within:ring-ring/50")}>
        Choose a file
        <input
          type="file"
          accept=".json,application/json"
          multiple
          className="absolute size-px opacity-0"
          onChange={(event) => {
            onFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
