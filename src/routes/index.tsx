import { createFileRoute } from "@tanstack/react-router";
import { Hud } from "@/components/hud/Hud";
import { AstraCanvas } from "@/components/scene/AstraCanvas";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-void text-fg">
      <AstraCanvas />
      <Hud />
    </main>
  );
}
