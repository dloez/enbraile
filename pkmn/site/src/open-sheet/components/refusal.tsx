import { CircleAlert } from "lucide-react";

export interface Refused {
  fileName: string;
  reason: string;
}

function Reason({ text }: { text: string }) {
  return text.split("`").map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="font-mono">
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
      className="mx-auto flex w-full max-w-180 items-center gap-3 rounded-xl border border-destructive bg-destructive-soft px-4 py-3.5"
    >
      <CircleAlert className="size-5 flex-none text-destructive" aria-hidden="true" />
      <span className="min-w-0 break-words">
        <span className="font-mono">{fileName}</span> <Reason text={reason} />.
      </span>
    </div>
  );
}
