import { BallSplit, ballTitleClass } from "@/components/ball-split";
import { buttonClass } from "@/components/controls";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { SignOutIcon, useSignOut } from "@/components/sign-out";

export function WaitingPage({ player }: { player: { id: string; name: string } }) {
  const { signingOut, signOut } = useSignOut();
  return (
    <BallSplit title={<span className={ballTitleClass}>pkmn</span>} className="px-6 pb-9 sm:pb-12">
      <div className="flex flex-col items-center gap-4 sm:gap-5">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <PlayerBadge name={player.name} colour={playerColour(player.id)} />
          <span className="font-heading text-2xl text-white">{player.name}</span>
        </div>
        <h1 className="m-0 text-center font-heading text-4xl leading-[0.9] font-normal text-white sm:text-6xl">Waiting for an admin</h1>
        <p className="m-0 text-center text-base leading-normal font-semibold text-muted-foreground sm:text-lg">
          An admin has to let you in before you can see the series.
        </p>
        <button type="button" disabled={signingOut} onClick={signOut} className={buttonClass}>
          <SignOutIcon className="size-4.5" />
          Sign out
        </button>
      </div>
    </BallSplit>
  );
}
