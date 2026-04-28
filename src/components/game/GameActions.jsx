import React from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Loader2 } from "lucide-react";

export default function GameActions({ onNewRound, loading }) {
  return (
    <Button
      variant="outline"
      onClick={onNewRound}
      disabled={loading}
      className="w-full h-10 gap-2"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RotateCcw className="w-4 h-4" />
      )}
      Nowa runda
    </Button>
  );
}