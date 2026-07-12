"use client";

import { useEffect, useState } from "react";

import { listFinalMatches, type MatchResponse } from "@/lib/matches";

export type FinalMatchWinner = {
  flagUrl: string;
  id: number;
  name: string;
};

const getWinnerFromFinalMatch = (match: MatchResponse): FinalMatchWinner | null => {
  if (match.winner_id === match.team1_id) {
    return {
      flagUrl: match.team1_flag_url,
      id: match.team1_id,
      name: match.team1_name,
    };
  }

  if (match.winner_id === match.team2_id) {
    return {
      flagUrl: match.team2_flag_url,
      id: match.team2_id,
      name: match.team2_name,
    };
  }

  return null;
};

const getFinalWinner = (matches: MatchResponse[]): FinalMatchWinner | null => {
  const finalMatch = matches.find(
    (match) => match.match_stage === "F" && match.winner_id !== null,
  );

  return finalMatch ? getWinnerFromFinalMatch(finalMatch) : null;
};

export const useFinalMatchWinner = () => {
  const [winner, setWinner] = useState<FinalMatchWinner | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadWinner = async () => {
      try {
        const response = await listFinalMatches({ includeLocked: true });
        if (isMounted) {
          setWinner(getFinalWinner(response.items));
        }
      } catch {
        if (isMounted) {
          setWinner(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadWinner();

    return () => {
      isMounted = false;
    };
  }, []);

  return { isLoading, winner };
};
