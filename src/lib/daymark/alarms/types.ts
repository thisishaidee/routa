import type { AlarmStatus, Checkpoint, ReminderPermission, Settings, WeekDay } from "../types";

export type AlarmPlatform = "web" | "android" | "ios";

/** Last known OS / notification outcome. Never a source of truth. */
export type SchedulingState =
  | "pending"
  | "listening"
  | "scheduled"
  | "fallback"
  | "permission-denied"
  | "unsupported"
  | "cancelled"
  | "failed";

/**
 * Platform-independent reminder the scheduler should realize.
 * Derived from the routine. Contains no OS handles and no secrets.
 */
export interface DesiredAlarm {
  alarmId: string;
  routineId: string;
  checkpointId: string;
  title: string;
  time: string;
  recurrence: WeekDay[];
  enabled: boolean;
  timezone: string;
}

/**
 * Per-device cache of the last sync. Future cloud sync sends the routine,
 * not these records — each device derives DesiredAlarm locally.
 */
export interface AlarmRecord {
  alarmId: string;
  routineId: string;
  checkpointId: string;
  title?: string;
  time: string;
  recurrence: WeekDay[];
  enabled: boolean;
  platform: AlarmPlatform;
  schedulingState: SchedulingState;
  lastSyncAt: string;
  timezone: string;
  nativeHandle?: string;
  lastError?: string;
}

export interface PlatformCapabilities {
  platform: AlarmPlatform;
  notifications: boolean;
  webPush: "unsupported" | "available" | "subscribed";
  exactAlarms: boolean;
  repeatingAlarms: boolean;
  /** Always false. ROUTA never injects into the Clock app. */
  clockAppInjection: false;
  bootReschedule: boolean;
  timezoneReschedule: boolean;
  backgroundWhenClosed: boolean;
  requiresOpenApp: boolean;
  alarmManager: boolean;
  alarmKit: boolean;
}

export interface NativeAlarmRequest {
  alarmId: string;
  routineId: string;
  checkpointId: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  weekdays: WeekDay[];
  oneShot: boolean;
  timezone: string;
}

export interface NativeAlarmResult {
  ok: boolean;
  handle?: string;
  error?: string;
}

export interface NativeAlarmHandle {
  alarmId: string;
  handle?: string;
}

/**
 * Injected by a native Android / iOS shell as `window.RoutaNativeAlarms`.
 * Absent in the browser — the web app must not fake it.
 */
export interface RoutaNativeAlarmsBridge {
  platform: "android" | "ios";
  canExactAlarm(): boolean | Promise<boolean>;
  checkPermission(): ReminderPermission | Promise<ReminderPermission>;
  requestPermission(): Promise<ReminderPermission>;
  schedule(request: NativeAlarmRequest): Promise<NativeAlarmResult> | NativeAlarmResult;
  scheduleRepeating?(request: NativeAlarmRequest): Promise<NativeAlarmResult> | NativeAlarmResult;
  cancel(alarmId: string): Promise<void> | void;
  update?(request: NativeAlarmRequest): Promise<NativeAlarmResult> | NativeAlarmResult;
  list(): Promise<NativeAlarmHandle[]> | NativeAlarmHandle[];
  rescheduleAll?(requests: NativeAlarmRequest[]): Promise<void> | void;
  requestExactAlarmAccess?: () => Promise<boolean>;
}

export interface NativeAlarmAdapter {
  platform: "android" | "ios";
  canExactAlarm(): boolean;
  checkPermission(): ReminderPermission;
  requestPermission(): Promise<ReminderPermission>;
  schedule(request: NativeAlarmRequest): Promise<NativeAlarmResult>;
  cancel(alarmId: string): Promise<void>;
  list(): Promise<NativeAlarmHandle[]>;
  rescheduleAll(requests: NativeAlarmRequest[]): Promise<void>;
}

export interface AlarmRegistry {
  read(): AlarmRecord[];
  write(records: AlarmRecord[]): void;
  clear(): void;
}

export interface SyncResult {
  scheduledIds: string[];
  listeningIds: string[];
  cancelledIds: string[];
  skipped: { id: string; reason: AlarmStatus }[];
}

export interface ReminderPolicyInput {
  checkpoints: Checkpoint[];
  settings: Settings;
  at: Date;
  permission: ReminderPermission;
}

export interface DueReminder {
  checkpoint: Checkpoint;
  key: string;
}

export interface AlarmScheduler {
  platform: AlarmPlatform;
  getPlatformCapabilities(): PlatformCapabilities;
  checkPermission(): ReminderPermission;
  requestPermission(): Promise<ReminderPermission>;
  /** @deprecated use checkPermission */
  permission(): ReminderPermission;
  canExactAlarm(): boolean;
  scheduleAlarm(alarm: DesiredAlarm): Promise<AlarmRecord>;
  scheduleRepeatingAlarm(alarm: DesiredAlarm): Promise<AlarmRecord>;
  cancelAlarm(alarmId: string): Promise<void>;
  updateAlarm(alarm: DesiredAlarm): Promise<AlarmRecord>;
  getScheduledAlarms(): AlarmRecord[];
  rescheduleAll(alarms: DesiredAlarm[]): Promise<SyncResult>;
  cancelAll(): Promise<void>;
  sync(checkpoints: Checkpoint[], settings: Settings, routineId?: string): Promise<SyncResult>;
  status(checkpoint: Checkpoint, settings: Settings, permission: ReminderPermission): AlarmStatus;
}

/**
 * Future cloud shape. A routine never stores platform handles.
 * Account → Routine → Checkpoint → Reminder → Device → platform alarm.
 */
export interface DeviceAlarmBinding {
  deviceId: string;
  alarmId: string;
  platform: AlarmPlatform;
  schedulingState: SchedulingState;
}
