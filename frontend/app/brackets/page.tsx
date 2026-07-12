import { BracketCanvas } from "@/components/brackets/bracket-canvas";
import { TournamentWinnerCelebration } from "@/components/celebrations/tournament-winner-celebration";
import { PageShell } from "@/components/ui/page-shell";

const BracketsPage = () => {
  return (
    <PageShell>
      <TournamentWinnerCelebration />
      <BracketCanvas />
    </PageShell>
  );
};

export default BracketsPage;
