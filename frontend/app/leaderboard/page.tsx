import { LeaderboardDashboard } from "@/components/leaderboard/leaderboard-dashboard";
import { PageShell } from "@/components/ui/page-shell";
import { RouteGuard } from "@/components/auth/route-guard";

export default function LeaderboardPage() {
  return (
    <RouteGuard allowedRoles={["USER"]}>
      <PageShell
        eyebrow="Leaderboard"
        subtitle="Rankings combine exact scores, goal difference, duration, opening team, and card predictions."
        title="Tournament Rankings"
      >
        <LeaderboardDashboard />
      </PageShell>
    </RouteGuard>
  );
}
