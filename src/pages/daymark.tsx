import { useState } from "react";
import { DaymarkProvider } from "@/lib/daymark/store";
import { AuthProvider } from "@/lib/auth/auth-context";
import { DaymarkScreen } from "@/components/daymark/screen";
import type { DaymarkView } from "@/components/daymark/nav";

export default function Daymark() {
  const [view, setView] = useState<DaymarkView>("today");
  return (
    <AuthProvider>
      <DaymarkProvider>
        <DaymarkScreen view={view} onNavigate={setView} />
      </DaymarkProvider>
    </AuthProvider>
  );
}
