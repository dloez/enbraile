import { CircleAlert } from "lucide-react";
import { messageWidth } from "@/components/page";
import { cn } from "@/lib/utils";

export interface Refused {
  fileName: string;
  reason: string;
}

function Reason({ text }: { text: string }) {
  return text.split("`").map((part, index) =>
    index % 2 === 1 ? (
      <span key={index}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export function Refusal({ fileName, reason }: Refused) {
  return (
    <div
      role="alert"
      className={cn(messageWidth, "flex items-center gap-3 rounded-xl border border-destructive bg-destructive-soft px-4 py-3.5")}
    >
      <CircleAlert className="size-5 flex-none text-destructive" aria-hidden="true" />
      <span className="min-w-0 break-words">
        {fileName} <Reason text={reason} />.
      </span>
    </div>
  );
}
