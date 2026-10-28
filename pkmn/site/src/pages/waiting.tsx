import { lazy, Suspense, useState } from "react";
import { BallSplit, ballTitleClass } from "@/components/ball-split";
import { buttonClass } from "@/components/controls";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { SignOutIcon, useSignOut } from "@/components/sign-out";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OwedSeries } from "../../shared/series";

const UploadDialog = lazy(() => import("@/components/upload-dialog").then((m) => ({ default: m.UploadDialog })));

export function WaitingPage({ player, owed = [], onUploaded }: { player: { id: string; name: string }; owed?: OwedSeries[]; onUploaded?: () => void }) {
  const { signingOut, signOut } = useSignOut();
  const [uploading, setUploading] = useState<OwedSeries | null>(null);
  const held = owed.length > 0;
  return (
    <BallSplit title={<span className={ballTitleClass}>pkmn</span>} className="px-6 pb-9 sm:pb-12">
      <div className="flex flex-col items-center gap-4 sm:gap-5">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <PlayerBadge name={player.name} colour={playerColour(player.name)} />
          <span className="font-heading text-2xl text-white">{player.name}</span>
        </div>
        <h1 className="m-0 text-center font-heading text-4xl leading-[0.9] font-normal text-white sm:text-6xl">
          {held ? "Upload your save" : "Waiting for an admin"}
        </h1>
        {held && (
          <>
            <p className="m-0 max-w-md text-center text-base leading-normal font-semibold text-muted-foreground sm:text-lg">
              {owed.length === 1
                ? `${owed[0]!.name} is under way. Upload your save to join it.`
                : "These series are under way. Upload your save to each to join them."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {owed.map((series) => (
                <button key={series.number} type="button" onClick={() => setUploading(series)} className={cn(buttonVariants({ variant: "go" }), "min-h-13 px-5.5")}>
                  {owed.length === 1 ? "Upload save" : `Upload to ${series.name}`}
                </button>
              ))}
            </div>
          </>
        )}
        <button type="button" disabled={signingOut} onClick={signOut} className={buttonClass}>
          <SignOutIcon className="size-4.5" />
          Sign out
        </button>
      </div>
      {uploading && (
        <Suspense>
          <UploadDialog
            open
            onOpenChange={(next) => {
              if (next) return;
              setUploading(null);
              onUploaded?.();
            }}
            seriesNumber={uploading.number}
            trainer={{ id: player.id, name: player.name, canUpload: true, progress: null, teams: 0, snapshots: [] }}
            forOther={false}
            milestones={uploading.milestones.map((m) => m.name)}
            onSaved={() => undefined}
          />
        </Suspense>
      )}
    </BallSplit>
  );
}
