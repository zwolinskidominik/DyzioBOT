export type LogEventType =
  | 'memberBan'
  | 'memberUnban'
  | 'memberKick'
  | 'memberTimeout'
  | 'moderationCommand'
  | 'messageDelete'
  | 'messageEdit'
  | 'memberJoin'
  | 'memberLeave'
  | 'memberNicknameChange'
  | 'memberRoleAdd'
  | 'memberRoleRemove'
  | 'voiceJoin'
  | 'voiceLeave'
  | 'voiceMove'
  | 'voiceDisconnect'
  | 'voiceMemberMove'
  | 'voiceStateChange'
  | 'channelCreate'
  | 'channelDelete'
  | 'channelUpdate'
  | 'channelPermissionUpdate'
  | 'threadCreate'
  | 'threadDelete'
  | 'threadUpdate'
  | 'roleCreate'
  | 'roleDelete'
  | 'roleUpdate'
  | 'guildUpdate'
  | 'inviteCreate'
  | 'antiSpam';

export interface LogEventConfig {
  name: string;
  emoji: string;
  color: number;
  description: string;
}

export const LOG_EVENT_CONFIGS: Record<LogEventType, LogEventConfig> = {
  memberBan: { name: 'Zbanowanie członka', emoji: '🔨', color: 0xFF0000, description: 'Użytkownik został zbanowany' },
  memberUnban: { name: 'Odbanowanie członka', emoji: '✈️', color: 0xFAA61A, description: 'Użytkownik został odbanowany' },
  memberKick: { name: 'Wyrzucenie członka', emoji: '👢', color: 0xFF4444, description: 'Użytkownik został wyrzucony' },
  memberTimeout: { name: 'Wyciszenie', emoji: '🔇', color: 0xFF8800, description: 'Wyciszenie (nadane/usunięte)' },
  moderationCommand: { name: 'Komenda moderacyjna', emoji: '⚖️', color: 0xFFAA00, description: 'Użyto komendy moderacyjnej' },
  
  messageDelete: { name: 'Usunięcie wiadomości', emoji: '🗑️', color: 0xFF6B6B, description: 'Wiadomość została usunięta' },
  messageEdit: { name: 'Edycja wiadomości', emoji: '✏️', color: 0x4A90E2, description: 'Wiadomość została zedytowana' },
  
  memberJoin: { name: 'Członek dołączył', emoji: '📥', color: 0x43B581, description: 'Nowy członek dołączył do serwera' },
  memberLeave: { name: 'Członek opuścił', emoji: '📤', color: 0xFAA61A, description: 'Członek opuścił serwer' },
  memberNicknameChange: { name: 'Zmiana pseudonimu', emoji: '📝', color: 0x95A5A6, description: 'Zmieniono pseudonim' },
  memberRoleAdd: { name: 'Nadanie roli', emoji: '➕', color: 0x3498DB, description: 'Nadano rolę' },
  memberRoleRemove: { name: 'Usunięcie roli', emoji: '➖', color: 0xE74C3C, description: 'Usunięto rolę' },
  
  voiceJoin: { name: 'Dołączył do VC', emoji: '🔊', color: 0x9B59B6, description: 'Dołączył do kanału głosowego' },
  voiceLeave: { name: 'Opuścił VC', emoji: '🔇', color: 0xE91E63, description: 'Opuścił kanał głosowy' },
  voiceMove: { name: 'Przełączył kanał VC', emoji: '🔄', color: 0x8E44AD, description: 'Przełączył się między kanałami głosowymi' },
  voiceDisconnect: { name: 'Odłączony od VC', emoji: '⚡', color: 0xC0392B, description: 'Odłączony od kanału głosowego (force)' },
  voiceMemberMove: { name: 'Przeniesiony do VC', emoji: '👉', color: 0xD35400, description: 'Przeniesiony do innego kanału (moderator)' },
  voiceStateChange: { name: 'Stan głosu', emoji: '🎤', color: 0x7F8C8D, description: 'Stan głosu (mute/deaf/stream/camera)' },
  
  channelCreate: { name: 'Utworzenie kanału', emoji: '📁', color: 0x1ABC9C, description: 'Utworzono kanał' },
  channelDelete: { name: 'Usunięcie kanału', emoji: '🗑️', color: 0xE67E22, description: 'Usunięto kanał' },
  channelUpdate: { name: 'Aktualizacja kanału', emoji: '✏️', color: 0x16A085, description: 'Zaktualizowano kanał' },
  channelPermissionUpdate: { name: 'Aktualizacja uprawnień', emoji: '🔐', color: 0x2C3E50, description: 'Zaktualizowano uprawnienia kanału' },
  
  threadCreate: { name: 'Tworzenie wątku', emoji: '🧵', color: 0x5DADE2, description: 'Utworzono wątek' },
  threadDelete: { name: 'Usuwanie wątku', emoji: '🗑️', color: 0xF39C12, description: 'Usunięto wątek' },
  threadUpdate: { name: 'Aktualizacja wątku', emoji: '✏️', color: 0x3498DB, description: 'Zaktualizowano wątek' },
  
  roleCreate: { name: 'Utworzenie roli', emoji: '🎭', color: 0xF1C40F, description: 'Utworzono rolę' },
  roleDelete: { name: 'Usunięcie roli', emoji: '🗑️', color: 0xE74C3C, description: 'Usunięto rolę' },
  roleUpdate: { name: 'Aktualizacja roli', emoji: '✏️', color: 0xE67E22, description: 'Zaktualizowano rolę' },
  
  guildUpdate: { name: 'Aktualizacja serwera', emoji: '🏠', color: 0x2C3E50, description: 'Zaktualizowano serwer' },
  inviteCreate: { name: 'Wysłano zaproszenie', emoji: '📨', color: 0x1F8B4C, description: 'Utworzono zaproszenie' },
  antiSpam: { name: 'Anti-Spam', emoji: '🛡️', color: 0xE74C3C, description: 'Wykryto spam — podjęto automatyczną akcję' },
};
