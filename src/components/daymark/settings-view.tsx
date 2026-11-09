import { useEffect, useRef, useState } from "react";
import { alarmStatusLabel, deniedRecoveryCopy, isStandaloneDisplay, pushSupport, reminderUxCopy } from "@/lib/daymark/notifications";
import { backupFilename } from "@/lib/daymark/backup";
import { useDaymark } from "@/lib/daymark/store";
import { clockLabel, deviceTimeZone } from "@/lib/daymark/time";
import { AccountCard } from "./account-card";
import { AgentLinkCard } from "./agent-link";
import { CalendarExportCard } from "./calendar-export";

export function SettingsView() {
  const {
    profile,
    updateProfile,
    routine,
    updateRoutineMeta,
    settings,
    updateSettings,
    permission,
    requestReminders,
    enableAllReminders,
    disableAllReminders,
    toggleCheckpointReminder,
    alarmStatus,
    capabilities,
    resetProgress,
    resetRoutine,
    clearAllData,
    exportBackup,
    importBackup,
  } = useDaymark();
  const [confirm, setConfirm] = useState<null | "progress" | "routine" | "all" | "import">(null);
  const [backupMessage, setBackupMessage] = useState("");
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [nameError, setNameError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const standalone = typeof window !== "undefined" && isStandaloneDisplay();
  const push = pushSupport();
  const copy = reminderUxCopy(capabilities, permission, settings.remindersEnabled);

  useEffect(() => {
    setNameDraft(profile.name);
  }, [profile.name]);

  const changeName = (value: string) => {
    setNameDraft(value);
    if (value.trim()) {
      setNameError("");
      updateProfile({ name: value });
    } else {
      setNameError("Name can't be empty.");
    }
  };

  const finishNameEdit = () => {
    if (nameDraft.trim()) return;
    setNameDraft(profile.name);
    setNameError("");
  };

  const enableReminders = async () => {
    if (permission === "unsupported") r...[truncated]