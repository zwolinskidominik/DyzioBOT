import { WarnModel } from '../../../src/models/Warn';

/**
 * Regresja: `WarnEntry` deklaruje `_id` jawnie (żeby TypeScript widział to pole), a taka
 * deklaracja WYŁĄCZA automatyczne nadawanie `_id` przez Mongoose. Bez `default` w modelu każdy
 * wpis miał `_id: undefined`, więc `String(w._id)` dawało dla wszystkich ten sam string
 * "undefined" — a wtedy usuwanie "po ID" trafiało w każdy wpis naraz.
 *
 * Test nie potrzebuje bazy: `_id` nadawane jest już przy tworzeniu podwpisu w pamięci.
 */
describe('Warn — identyfikatory pojedynczych ostrzeżeń', () => {
  function makeRecordWithTwoWarnings() {
    const doc = new WarnModel({ userId: 'u1', guildId: 'g1', warnings: [] });
    // `date` ma w schemacie default, ale typ WarnEntry wymaga go jawnie przy push().
    doc.warnings.push({ reason: 'pierwsze', date: new Date(), moderatorId: 'mod-1', moderatorTag: 'Mod#0001' });
    doc.warnings.push({ reason: 'drugie', date: new Date(), moderatorId: 'mod-1', moderatorTag: 'Mod#0001' });
    return doc;
  }

  it('nadaje każdemu wpisowi własne, niepuste _id', () => {
    const doc = makeRecordWithTwoWarnings();

    for (const warning of doc.warnings) {
      expect(warning._id).toBeDefined();
      expect(String(warning._id)).toMatch(/^[a-f0-9]{24}$/);
    }
  });

  it('nadaje różne _id różnym wpisom', () => {
    const doc = makeRecordWithTwoWarnings();
    const ids = doc.warnings.map((w) => String(w._id));

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pozwala wskazać dokładnie jeden wpis po jego _id', () => {
    const doc = makeRecordWithTwoWarnings();
    const targetId = String(doc.warnings[1]._id);

    const remaining = doc.warnings.filter((w) => String(w._id) !== targetId);

    expect(remaining).toHaveLength(1);
    expect(remaining[0].reason).toBe('pierwsze');
  });
});
