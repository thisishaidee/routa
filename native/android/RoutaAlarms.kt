package app.routa.alarms

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.TimeZone

/**
 * ROUTA Android alarm adapter.
 *
 * Uses AlarmManager.setAlarmClock for the next occurrence only.
 * Do not use setRepeating — it is inexact. The receiver reschedules
 * the next fire after each alert.
 *
 * This does not write into the Clock app. ROUTA owns these alarms.
 *
 * Persist definitions here so BOOT_COMPLETED and TIMEZONE_CHANGED can
 * reschedule without JavaScript.
 */
object RoutaAlarmScheduler {
    private const val PREFS = "routa_alarms"
    private const val KEY = "definitions"
    private const val CHANNEL = "routa_checkpoints"
    const val ACTION_FIRE = "app.routa.alarms.FIRE"
    const val EXTRA_ALARM_ID = "alarmId"

    data class Definition(
        val alarmId: String,
        val routineId: String,
        val checkpointId: String,
        val title: String,
        val body: String,
        val hour: Int,
        val minute: Int,
        val weekdays: List<Int>,
        val oneShot: Boolean,
        val timezone: String,
        val enabled: Boolean,
    )

    fun canExactAlarm(context: Context): Boolean {
        val manager = manager(context)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            manager.canScheduleExactAlarms()
        } else {
            true
        }
    }

    fun schedule(context: Context, definition: Definition): Boolean {
        persist(context, definition.copy(enabled = true))
        if (!canExactAlarm(context)) return false
        val triggerAt = nextTriggerUtcMillis(definition, System.currentTimeMillis()) ?: return false
        val pending = pendingIntent(context, definition.alarmId)
        manager(context).setAlarmClock(
            AlarmManager.AlarmClockInfo(triggerAt, pending),
            pending,
        )
        return true
    }

    fun cancel(context: Context, alarmId: String) {
        manager(context).cancel(pendingIntent(context, alarmId))
        remove(context, alarmId)
    }

    fun update(context: Context, definition: Definition): Boolean {
        cancel(context, definition.alarmId)
        return schedule(context, definition)
    }

    fun rescheduleAll(context: Context) {
        for (definition in loadAll(context).filter { it.enabled }) {
            schedule(context, definition)
        }
    }

    fun list(context: Context): List<Definition> = loadAll(context).filter { it.enabled }

    fun nextTriggerUtcMillis(definition: Definition, nowMillis: Long): Long? {
        if (!definition.enabled) return null
        val zone = timeZone(definition.timezone)
        val now = Calendar.getInstance(zone).apply { timeInMillis = nowMillis }
        if (definition.oneShot || definition.weekdays.isEmpty()) {
            val fire = now.clone() as Calendar
            fire.set(Calendar.HOUR_OF_DAY, definition.hour)
            fire.set(Calendar.MINUTE, definition.minute)
            fire.set(Calendar.SECOND, 0)
            fire.set(Calendar.MILLISECOND, 0)
            if (fire.timeInMillis <= nowMillis) fire.add(Calendar.DAY_OF_YEAR, 1)
            return fire.timeInMillis
        }
        for (offset in 0..8) {
            val candidate = now.clone() as Calendar
            candidate.add(Calendar.DAY_OF_YEAR, offset)
            candidate.set(Calendar.HOUR_OF_DAY, definition.hour)
            candidate.set(Calendar.MINUTE, definition.minute)
            candidate.set(Calendar.SECOND, 0)
            candidate.set(Calendar.MILLISECOND, 0)
            if (!definition.weekdays.contains(toRoutaWeekday(candidate))) continue
            if (candidate.timeInMillis > nowMillis) return candidate.timeInMillis
        }
        return null
    }

    private fun toRoutaWeekday(calendar: Calendar): Int {
        return when (calendar.get(Calendar.DAY_OF_WEEK)) {
            Calendar.MONDAY -> 0
            Calendar.TUESDAY -> 1
            Calendar.WEDNESDAY -> 2
            Calendar.THURSDAY -> 3
            Calendar.FRIDAY -> 4
            Calendar.SATURDAY -> 5
            else -> 6
        }
    }

    private fun timeZone(id: String): TimeZone {
        return if (id.isBlank() || id == "local") TimeZone.getDefault() else TimeZone.getTimeZone(id)
    }

    private fun manager(context: Context) =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private fun pendingIntent(context: Context, alarmId: String): PendingIntent {
        val intent = Intent(context, RoutaAlarmReceiver::class.java).apply {
            action = ACTION_FIRE
            putExtra(EXTRA_ALARM_ID, alarmId)
        }
        return PendingIntent.getBroadcast(
            context,
            alarmId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun loadAll(context: Context): List<Definition> {
        val raw = prefs(context).getString(KEY, "[]") ?: "[]"
        val array = JSONArray(raw)
        val items = mutableListOf<Definition>()
        for (index in 0 until array.length()) {
            val json = array.getJSONObject(index)
            val days = json.optJSONArray("weekdays") ?: JSONArray()
            val weekdays = (0 until days.length()).map { days.getInt(it) }
            items += Definition(
                alarmId = json.getString("alarmId"),
                routineId = json.optString("routineId"),
                checkpointId = json.optString("checkpointId"),
                title = json.optString("title"),
                body = json.optString("body"),
                hour = json.optInt("hour"),
                minute = json.optInt("minute"),
                weekdays = weekdays,
                oneShot = json.optBoolean("oneShot"),
                timezone = json.optString("timezone", "local"),
                enabled = json.optBoolean("enabled", true),
            )
        }
        return items
    }

    private fun persist(context: Context, definition: Definition) {
        val next = loadAll(context).filter { it.alarmId != definition.alarmId } + definition
        writeAll(context, next)
    }

    private fun remove(context: Context, alarmId: String) {
        writeAll(context, loadAll(context).filter { it.alarmId != alarmId })
    }

    private fun writeAll(context: Context, items: List<Definition>) {
        val array = JSONArray()
        for (item in items) {
            val json = JSONObject()
            json.put("alarmId", item.alarmId)
            json.put("routineId", item.routineId)
            json.put("checkpointId", item.checkpointId)
            json.put("title", item.title)
            json.put("body", item.body)
            json.put("hour", item.hour)
            json.put("minute", item.minute)
            json.put("weekdays", JSONArray(item.weekdays))
            json.put("oneShot", item.oneShot)
            json.put("timezone", item.timezone)
            json.put("enabled", item.enabled)
            array.put(json)
        }
        prefs(context).edit().putString(KEY, array.toString()).apply()
    }

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "Routa checkpoints", NotificationManager.IMPORTANCE_HIGH),
        )
    }

    fun notify(context: Context, definition: Definition) {
        ensureChannel(context)
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Routa · ${definition.title}")
            .setContentText(definition.body.ifBlank { "Time for ${definition.title}." })
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.notify(definition.alarmId.hashCode(), notification)
    }
}

class RoutaAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != RoutaAlarmScheduler.ACTION_FIRE) return
        val alarmId = intent.getStringExtra(RoutaAlarmScheduler.EXTRA_ALARM_ID) ?: return
        val definition = RoutaAlarmScheduler.list(context).firstOrNull { it.alarmId == alarmId } ?: return
        RoutaAlarmScheduler.notify(context, definition)
        if (definition.oneShot) {
            RoutaAlarmScheduler.cancel(context, alarmId)
        } else {
            RoutaAlarmScheduler.schedule(context, definition)
        }
    }
}

class RoutaBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != Intent.ACTION_LOCKED_BOOT_COMPLETED
        ) return
        RoutaAlarmScheduler.rescheduleAll(context)
    }
}

class RoutaTimeChangeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_TIMEZONE_CHANGED &&
            intent.action != Intent.ACTION_TIME_CHANGED
        ) return
        RoutaAlarmScheduler.rescheduleAll(context)
    }
}
