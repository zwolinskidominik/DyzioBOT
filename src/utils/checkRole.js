/**
 * Funkcja pomocnicza checkRole sprawdza, czy targetMember (użytkownik docelowy)
 * może być moderowany przez requestMember (użytkownika wywołującego komendę)
 * przy jednoczesnej weryfikacji hierarchii bota (botMember).
 *
 * Warunki:
 * - Nie można moderować właściciela serwera.
 * - Rola targetMember musi mieć niższą pozycję niż rola requestMember.
 * - Rola targetMember musi mieć niższą pozycję niż rola bota.
 *
 * @param {GuildMember} targetMember - Użytkownik, którego chcemy moderować.
 * @param {GuildMember} requestMember - Użytkownik, który wywołuje komendę.
 * @param {GuildMember} botMember - Członek bota (zazwyczaj interaction.guild.members.me).
 * @returns {boolean} - Zwraca true, gdy targetMember może być moderowany, w przeciwnym razie false.
 */
function checkRole(targetMember, requestMember, botMember) {
    if (!targetMember || !requestMember || !botMember) {
      throw new Error("Wszystkie trzy parametry muszą być dostarczone.");
    }
    // Nie można moderować właściciela serwera
    if (targetMember.id === targetMember.guild.ownerId) {
      return false;
    }
    const targetPos = targetMember.roles.highest.position;
    const requestPos = requestMember.roles.highest.position;
    const botPos = botMember.roles.highest.position;
  
    if (targetPos >= requestPos) return false;
    if (targetPos >= botPos) return false;
    return true;
  }
  
  module.exports = checkRole;
  