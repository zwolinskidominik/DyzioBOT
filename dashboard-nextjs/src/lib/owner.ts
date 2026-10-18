/** Discord user IDs allowed to access owner-only dashboard modules. */
export const OWNER_IDS = ['548177225661546496', '548182827532025897'];

/** Guild IDs where owner-only guild-locked modules are accessible. */
export const OWNER_GUILD_IDS = ['881293681783623680', '1264582308003053570'];

/**
 * Serwery, na których można zmieniać profil bota (nick/opis/avatar/banner) w Ustawieniach.
 * Na razie tylko główny serwer właściciela — gdzie indziej to przyszła funkcja premium.
 * Osobno od OWNER_GUILD_IDS, bo tamta lista włącza też inne moduły (turniej, Wrapped itd.).
 */
export const PROFILE_EDIT_GUILD_IDS = ['881293681783623680'];
