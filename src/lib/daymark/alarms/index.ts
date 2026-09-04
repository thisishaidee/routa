/**
 * ROUTA alarm architecture
 *
 * Routine (source of truth)
 *   → desiredAlarms (pure, no platform fields)
 *     → AlarmScheduler.sync / rescheduleAll
 *       → web: in-page notifications while open
 *       → native: only if window.RoutaNativeAlarms is injected
 *     → registry cache (routa:v2:alarms) is last-known state, not truth
 *
 * Web never reports AlarmStatus "scheduled".
 * Native "scheduled" requires an OS adapter that confirmed exact alarms.
 * Clock-app injection is always false.
 */
export type {
  AlarmPlatform,
  AlarmRecord,
  AlarmRegistry,
  AlarmScheduler,
  DesiredAlarm,
  DeviceAlarmBinding,
  NativeAlarmAdapter,
  NativeAlarmRequest,
  NativeAlarmResult,
  PlatformCapabilities,
  ReminderPolicyInput,
  DueReminder,
  RoutaNativeAlarmsBridge,
  SchedulingState,
  SyncResult,
} from "./types";

export {
  alarmFingerprint,
  alarmIdFor,
  alarmKey,
  alarmStatusLabel,
  alreadyFired,
  classifyAlarmStatus,
  desiredAlarms,
  dueNow,
  isReminderEligible,
  markFired,
  shouldScheduleCheckpoint,
} from "./policy";

export { ALARMS_KEY, clearAlarmRegistry, createLocalRegistry, createMemoryRegistry, readAlarmRegistry } from "./registry";

export {
  detectNativeBridge,
  isStandaloneDisplay,
  pushSupport,
  reminderPermission,
  requestReminderPermission,
  webCapabilities,
  webPushStatus,
} from "./platforms";

export {
  androidAlarmScheduler,
  createAlarmScheduler,
  createAndroidScheduler,
  createIosScheduler,
  getAlarmScheduler,
  iosAlarmScheduler,
  webNotificationScheduler,
} from "./scheduler";

export { deniedRecoveryCopy, reminderUxCopy } from "./copy";
