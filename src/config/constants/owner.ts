/**
 * Owner-restricted constants for bot-side access control.
 * Mirrors dashboard-nextjs/src/lib/owner.ts — keep in sync.
 */
export const OWNER_IDS = ['548177225661546496', '548182827532025897'] as const;

/** Guilds where private modules (tournament, disboard, wrapped) are allowed to operate. */
export const OWNER_GUILD_IDS = ['881293681783623680', '1264582308003053570'] as const;
