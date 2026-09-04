# ROUTA native alarms

These files are the production contract for a future Android / iOS shell.
The web app in this repo does **not** compile them.

Until a native shell injects `window.RoutaNativeAlarms`, Routa is a web/PWA
product. It uses page-open notifications. It never reports a Clock alarm.

## Bridge

The native shell must attach this object on the WebView window:

```js
window.RoutaNativeAlarms = {
  platform: "android" | "ios",
  canExactAlarm(): boolean,
  checkPermission(): "granted" | "denied" | "default" | "unsupported",
  requestPermission(): Promise<same>,
  schedule(request): Promise<{ ok, handle?, error? }>,
  scheduleRepeating(request): Promise<{ ok, handle?, error? }>,
  cancel(alarmId): Promise<void>,
  list(): Promise<{ alarmId, handle? }[]>,
  rescheduleAll(requests): Promise<void>,
}
```

`request` fields: `alarmId`, `routineId`, `checkpointId`, `title`, `body`,
`hour`, `minute`, `weekdays` (0 = Monday … 6 = Sunday), `oneShot`, `timezone`.

Stable id: `al_{routineId}_{checkpointId}`.

Do not add alarms to the Clock app. ROUTA owns its alarms through AlarmManager
(Android) or AlarmKit (iOS).

## Persistence

Native code must persist alarm definitions on device so reboot and timezone
changes can reschedule without JavaScript. The web `routa:v2:alarms` registry
is only a last-known cache.

Routine configuration remains the source of truth. After a routine change the
web app calls `sync()`. After boot the native receiver calls `rescheduleAll`.
