import AlarmKit
import Foundation
import UserNotifications

/**
 ROUTA iOS alarm adapter.

 Uses AlarmKit on iOS 26+ for one-time and weekly relative alarms.
 Relative schedules follow the device time zone. ROUTA owns these
 alarms through AlarmKit — this does not write into the Clock app.

 If AlarmKit is unavailable or authorization is denied, fall back to
 UserNotifications and report that as a notification, not a scheduled
 native alarm.
 */
enum RoutaAlarms {
    struct Definition: Codable, Equatable {
        var alarmId: String
        var routineId: String
        var checkpointId: String
        var title: String
        var body: String
        var hour: Int
        var minute: Int
        var weekdays: [Int]
        var oneShot: Bool
        var timezone: String
        var enabled: Bool
    }

    private static let storeKey = "routa.alarms.definitions"
    private static let idMapKey = "routa.alarms.idmap"

    static func canExactAlarm() -> Bool {
        if #available(iOS 26.0, *) {
            return AlarmManager.shared.authorizationState == .authorized
        }
        return false
    }

    static func checkPermission() -> String {
        if #available(iOS 26.0, *) {
            switch AlarmManager.shared.authorizationState {
            case .authorized: return "granted"
            case .denied: return "denied"
            case .notDetermined: return "default"
            @unknown default: return "unsupported"
            }
        }
        return notificationPermission()
    }

    static func requestPermission() async -> String {
        if #available(iOS 26.0, *) {
            do {
                let state = try await AlarmManager.shared.requestAuthorization()
                if state == .authorized { return "granted" }
                if state == .denied { return "denied" }
            } catch {
                return "denied"
            }
        }
        return await requestNotificationPermission()
    }

    @available(iOS 26.0, *)
    static func schedule(_ definition: Definition) async throws {
        persist(definition)
        guard definition.enabled else {
            try await cancel(definition.alarmId)
            return
        }
        let id = stableId(for: definition.alarmId)
        let time = Alarm.Schedule.Relative.Time(hour: definition.hour, minute: definition.minute)
        let repeats: Alarm.Schedule.Relative.Recurrence = {
            if definition.oneShot || definition.weekdays.isEmpty { return .never }
            return .weekly(definition.weekdays.compactMap(localeWeekday))
        }()
        let schedule = Alarm.Schedule.relative(.init(time: time, repeats: repeats))
        let attributes = AlarmAttributes<Never>(
            presentation: AlarmPresentation(
                alert: AlarmPresentation.Alert(
                    title: LocalizedStringResource(stringLiteral: "Routa · \(definition.title)"),
                    stopButton: AlarmButton(text: "Done", textColor: .white, systemImage: "checkmark")
                )
            ),
            tintColor: .green
        )
        let configuration = AlarmManager.AlarmConfiguration(
            schedule: schedule,
            attributes: attributes,
            secondaryIntent: nil,
            sound: .default
        )
        _ = try await AlarmManager.shared.schedule(id: id, configuration: configuration)
    }

    static func scheduleFallback(_ definition: Definition) async {
        persist(definition)
        let content = UNMutableNotificationContent()
        content.title = "Routa · \(definition.title)"
        content.body = definition.body.isEmpty ? "Time for \(definition.title)." : definition.body
        content.sound = .default
        var components = DateComponents()
        components.hour = definition.hour
        components.minute = definition.minute
        if !definition.oneShot, let first = definition.weekdays.first {
            components.weekday = iosCalendarWeekday(first)
        }
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: !definition.oneShot)
        let request = UNNotificationRequest(identifier: definition.alarmId, content: content, trigger: trigger)
        try? await UNUserNotificationCenter.current().add(request)
    }

    static func cancel(_ alarmId: String) async throws {
        if #available(iOS 26.0, *) {
            try await AlarmManager.shared.cancel(id: stableId(for: alarmId))
        }
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [alarmId])
        remove(alarmId)
    }

    static func update(_ definition: Definition) async throws {
        try await cancel(definition.alarmId)
        if canExactAlarm() {
            try await schedule(definition)
        } else {
            await scheduleFallback(definition)
        }
    }

    static func rescheduleAll() async {
        for definition in loadAll() where definition.enabled {
            if canExactAlarm() {
                try? await schedule(definition)
            } else {
                await scheduleFallback(definition)
            }
        }
    }

    static func list() -> [Definition] { loadAll().filter(\.enabled) }

    private static func localeWeekday(_ day: Int) -> Locale.Weekday? {
        switch day {
        case 0: return .monday
        case 1: return .tuesday
        case 2: return .wednesday
        case 3: return .thursday
        case 4: return .friday
        case 5: return .saturday
        case 6: return .sunday
        default: return nil
        }
    }

    /// Foundation weekday: 1 = Sunday. ROUTA weekday: 0 = Monday.
    private static func iosCalendarWeekday(_ day: Int) -> Int {
        day == 6 ? 1 : day + 2
    }

    private static func stableId(for alarmId: String) -> Alarm.ID {
        var map = UserDefaults.standard.dictionary(forKey: idMapKey) as? [String: String] ?? [:]
        if let stored = map[alarmId], let uuid = UUID(uuidString: stored) {
            return uuid
        }
        let uuid = UUID()
        map[alarmId] = uuid.uuidString
        UserDefaults.standard.set(map, forKey: idMapKey)
        return uuid
    }

    private static func persist(_ definition: Definition) {
        var items = loadAll().filter { $0.alarmId != definition.alarmId }
        items.append(definition)
        writeAll(items)
    }

    private static func remove(_ alarmId: String) {
        writeAll(loadAll().filter { $0.alarmId != alarmId })
    }

    private static func loadAll() -> [Definition] {
        guard let data = UserDefaults.standard.data(forKey: storeKey) else { return [] }
        return (try? JSONDecoder().decode([Definition].self, from: data)) ?? []
    }

    private static func writeAll(_ items: [Definition]) {
        if let data = try? JSONEncoder().encode(items) {
            UserDefaults.standard.set(data, forKey: storeKey)
        }
    }

    private static func notificationPermission() -> String {
        // Checked asynchronously in production; default keeps the JS layer honest.
        "default"
    }

    private static func requestNotificationPermission() async -> String {
        let granted = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
        return granted == true ? "granted" : "denied"
    }
}
