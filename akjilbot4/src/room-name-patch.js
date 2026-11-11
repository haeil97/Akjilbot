// ---- 방 이름 보정: 카카오톡 26.7.0 알림 대응 ----
if (typeof BotManager !== "undefined" && typeof Java !== "undefined" && typeof Event !== "undefined") {
var bot = BotManager.getCurrentBot();
/* =================================== 전역 상수/변수 =================================== */


const ActivityThreadForRoomName = Java.type("android.app.ActivityThread");
const RankingForRoomName = Java.type("android.service.notification.NotificationListenerService$Ranking");

const ROOM_NAME_KAKAOTALK_PACKAGE = "com.kakao.talk";
const ROOM_NAME_LISTENER_CLASS = "android.service.notification.NotificationListenerService";
const ROOM_NAME_CACHE_TTL_MS = 15000;
const ROOM_NAME_CACHE_MAX_SIZE = 256;

const _roomNameUsesMessageEvent = bot.listeners(Event.MESSAGE).length > 0;
const _roomNameUsesCommandEvent = bot.listeners(Event.COMMAND).length > 0;

const _roomNameByLogId = new Map();
const _roomNameByChannelId = new Map();
let _roomNameNotificationListener = null;




/* =================================== 헬퍼/유틸 =================================== */


/**
 * @description Java 객체가 지정한 클래스 또는 하위 클래스인지 확인
 * @param {object} value Java 객체
 * @param {string} expectedClassName 기준 클래스명
 * @returns {boolean} 일치 여부
 */
function _roomNameIsInstanceOf(value, expectedClassName) {
    if (!value || typeof value.getClass !== "function") return false;

    let currentClass = value.getClass();
    while (currentClass) {
        if (String(currentClass.getName()) === expectedClassName) return true;
        currentClass = currentClass.getSuperclass();
    }
    return false;
}

/**
 * @description MessengerBot R 프로세스의 알림 리스너 서비스 조회
 * @returns {android.service.notification.NotificationListenerService|null} 리스너
 */
function _getRoomNameNotificationListener() {
    if (_roomNameNotificationListener) return _roomNameNotificationListener;

    const activityThread = ActivityThreadForRoomName.currentActivityThread();
    if (!activityThread) return null;

    const servicesField =
        ActivityThreadForRoomName.class.getDeclaredField("mServices");
    servicesField.setAccessible(true);

    const services = servicesField.get(activityThread);
    if (!services) return null;

    const iterator = services.values().iterator();
    while (iterator.hasNext()) {
        const service = iterator.next();
        if (_roomNameIsInstanceOf(service, ROOM_NAME_LISTENER_CLASS)) {
            _roomNameNotificationListener = service;
            return service;
        }
    }
    return null;
}

/**
 * @description 현재 알림의 ShortcutInfo 표시 이름 조회
 * @param {android.service.notification.StatusBarNotification} sbn SBN
 * @returns {string} 방 이름 또는 빈 문자열
 */
function _getShortcutRoomName(sbn) {
    const listener = _getRoomNameNotificationListener();
    if (!listener) return "";

    const rankingMap = listener.getCurrentRanking();
    if (!rankingMap) return "";

    const ranking = new RankingForRoomName();
    if (!rankingMap.getRanking(sbn.getKey(), ranking)) return "";

    const shortcut = ranking.getConversationShortcutInfo();
    if (!shortcut) return "";

    const longLabel = shortcut.getLongLabel();
    if (longLabel !== null && String(longLabel).trim()) {
        return String(longLabel).trim();
    }

    const shortLabel = shortcut.getShortLabel();
    return shortLabel === null ? "" : String(shortLabel).trim();
}

/** @description 만료되거나 최대 개수를 넘긴 방 이름 캐시 정리 */
function _pruneRoomNameCache() {
    const now = Date.now();

    for (const [key, item] of _roomNameByLogId) {
        if ((now - item.savedAt) > ROOM_NAME_CACHE_TTL_MS) {
            _roomNameByLogId.delete(key);
        }
    }
    for (const [key, item] of _roomNameByChannelId) {
        if ((now - item.savedAt) > ROOM_NAME_CACHE_TTL_MS) {
            _roomNameByChannelId.delete(key);
        }
    }
    while (_roomNameByLogId.size > ROOM_NAME_CACHE_MAX_SIZE) {
        _roomNameByLogId.delete(_roomNameByLogId.keys().next().value);
    }
    while (_roomNameByChannelId.size > ROOM_NAME_CACHE_MAX_SIZE) {
        _roomNameByChannelId.delete(_roomNameByChannelId.keys().next().value);
    }
}

/**
 * @description 알림에서 추출한 방 이름을 logId와 channelId에 연결
 * @param {android.service.notification.StatusBarNotification} sbn SBN
 * @param {string} roomName 방 이름
 */
function _cacheRoomNameFromNotification(sbn, roomName) {
    const notification = sbn.getNotification();
    const extras = notification.extras;
    const shortcutId = notification.getShortcutId();
    const savedAt = Date.now();
    const item = { roomName, savedAt };

    if (shortcutId !== null) {
        _roomNameByChannelId.set(String(shortcutId), item);
    }

    if (extras) {
        const chatLogId = extras.get("chatLogId");
        if (chatLogId !== null) {
            _roomNameByLogId.set(String(chatLogId), item);
        }
    }

    _pruneRoomNameCache();
}
/**
 * @description MESSAGE 또는 COMMAND 객체에 대응하는 캐시 항목 조회
 * @param {object} event API2 이벤트 객체
 * @returns {{roomName: string, savedAt: number}|null} 캐시 항목
 */
function _findCachedRoomName(event) {
    _pruneRoomNameCache();

    if (event.logId !== undefined && event.logId !== null) {
        const exact = _roomNameByLogId.get(String(event.logId));
        if (exact) return exact;
    }

    if (event.channelId !== undefined && event.channelId !== null) {
        const byChannel = _roomNameByChannelId.get(String(event.channelId));
        if (byChannel) return byChannel;
    }
    return null;
}

/**
 * @description 기존 리스너가 받을 이벤트 객체의 room을 직접 보정
 * @param {object} event API2 이벤트 객체
 */
function _correctRoomNameBeforeListeners(event) {
    const cached = _findCachedRoomName(event);
    if (!cached) return;
    event.room = cached.roomName;
}




/* =================================== 메인 로직 =================================== */


/**
 * @description 알림에서 실제 방 이름을 추출해 뒤따르는 이벤트용으로 저장
 * @param {android.service.notification.StatusBarNotification} sbn SBN
 */
function onNoti(sbn) {
    if (!sbn || sbn.getPackageName() !== ROOM_NAME_KAKAOTALK_PACKAGE) return;
    if (sbn.getNotification().getShortcutId() === null) return;

    try {
        const roomName = _getShortcutRoomName(sbn);
        if (roomName) _cacheRoomNameFromNotification(sbn, roomName);
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
    }
}




/* =================================== 이벤트/내보내기 =================================== */


if (_roomNameUsesMessageEvent || _roomNameUsesCommandEvent) {
    bot.addListener(Event.NOTIFICATION_POSTED, onNoti);
}
if (_roomNameUsesMessageEvent) {
    bot.prependListener(Event.MESSAGE, _correctRoomNameBeforeListeners);
}
if (_roomNameUsesCommandEvent) {
    bot.prependListener(Event.COMMAND, _correctRoomNameBeforeListeners);
}
// [출처] 카톡 26.7.0 알림 구조 변경 대응 소스 (카카오톡 봇 커뮤니티 : 카카오톡 오픈채팅방 챗봇 구현) | 작성자 헤히
}
