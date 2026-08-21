import { useState } from "react";
import { DaymarkProvider } from "@/lib/daymark/store";
import { DaymarkScreen } from "@/components/daymark/screen";
import type { DaymarkView } from "@/components/daymark/nav";

export default function Daymark() {
  const [view, setView] = useState<DaymarkView>("today");
  return (
    <DaymarkProvider>
      <DaymarkScreen view={view} onNavigate={setView} />
    </DaymarkProvider>
  );
}
