# DyzioBOT — Database Standards (MongoDB)

> MongoDB Atlas + Mongoose 9 + Typegoose 13.  
> Multi-tenant: guildId jako partition key. Każda query musi mieć scope.

---

## 1. MULTI-TENANT IZOLACJA (PRIORYTET #1)

### 1.1 Zasada absolutna

```typescript
// ✅ ZAWSZE — guildId scope:
await GuildConfig.findOne({ guildId: interaction.guildId });
await Question.find({ guildId }).limit(50);
await XPModel.findOneAndUpdate({ guildId, userId }, { $inc: { xp: 10 } });

// ❌ NIGDY — brak scope = data leak between tenants!
await GuildConfig.findOne({ name: 'something' });
await Question.find({});
await XPModel.find({ userId });  // userId NIE jest tenant key!
```

### 1.2 Weryfikacja izolacji

Każdy nowy serwis / query musi przejść ten checklist:
- [ ] Czy query zawiera `guildId` w filtrze?
- [ ] Czy wyniki mogą zawierać dane z innej gildii?
- [ ] Czy bulkowe operacje są scope'owane per-guild?

---

## 2. MODELE TYPEGOOSE

### 2.1 Wzorzec modelu

```typescript
// src/models/Giveaway.ts
import { prop, modelOptions, index, getModelForClass } from '@typegoose/typegoose';
import { Types } from 'mongoose';

@modelOptions({
  schemaOptions: {
    timestamps: true,           // createdAt, updatedAt automatycznie
    collection: 'giveaways',    // explicit collection name
  },
})
@index({ guildId: 1, active: 1 })     // compound index dla typowych queries
@index({ endsAt: 1 }, { expireAfterSeconds: 0 })  // TTL index (opcjonalne)
export class Giveaway {
  @prop({ required: true, index: true })
  guildId!: string;            // ZAWSZE wymagane

  @prop({ required: true })
  channelId!: string;

  @prop({ required: true })
  messageId!: string;

  @prop({ required: true })
  creatorId!: string;

  @prop({ required: true, trim: true, maxlength: 500 })
  prize!: string;

  @prop({ required: true, min: 1, max: 20 })
  winnerCount!: number;

  @prop({ required: true })
  endsAt!: Date;

  @prop({ default: true })
  active!: boolean;

  @prop({ type: () => [String], default: [] })
  entries!: string[];           // userId[]

  @prop({ type: () => [String], default: [] })
  winners!: string[];           // userId[]

  @prop()
  endedAt?: Date;               // opcjonalne: kiedy zakończono

  // timestamps: true daje createdAt + updatedAt automatycznie
}

export const GiveawayModel = getModelForClass(Giveaway);
```

### 2.2 Wymagane pola w każdym modelu z danymi gildii

```typescript
// OBOWIĄZKOWE:
@prop({ required: true, index: true })
guildId!: string;

// ZALECANE (przez timestamps: true):
createdAt: Date;
updatedAt: Date;

// OPCJONALNE ale zalecane dla danych audytowalnych:
@prop()
deletedAt?: Date;   // soft delete zamiast hard delete
```

### 2.3 Typy danych — standardy

| Dane | Typ MongoDB | Uwagi |
|---|---|---|
| Discord IDs (userId, guildId, channelId) | `string` | Snowflake jako string, nie BigInt |
| Daty | `Date` | Zawsze UTC |
| Liczniki | `number` | `min`, `max` validators |
| Opisy, treści | `string` | `trim: true`, `maxlength` ustawiony |
| Flagi boolean | `boolean` | `default` wartość zawsze ustawiona |
| Tablice | `type: () => [Type]` | Typegoose wymaga `type: () => [...]` |
| Enum | `enum: Object.values(MyEnum)` | Zod + MongoDB enum |

---

## 3. INDEKSOWANIE

### 3.1 Obowiązkowe indeksy

Każdy model musi mieć:

```typescript
// Compound index na guildId + najczęściej filtrowanym polu:
@index({ guildId: 1, active: 1 })           // giveaways: szukamy aktywnych per guild
@index({ guildId: 1, userId: 1 })           // XP: per user per guild
@index({ guildId: 1, createdAt: -1 })       // pytania QOTD: sortowanie po dacie
@index({ guildId: 1, ticketNumber: 1 })     // tickets: numer ticketa w gildii
```

### 3.2 Kiedy dodawać indeksy

- Dodaj gdy query jest w hot path (every command execution)
- Indeks spowalnia write — nie indeksuj wszystkiego
- Sprawdź `explain()` dla slow queries:
  ```typescript
  const explain = await Model.find({ guildId }).explain('executionStats');
  console.log(explain.executionStats.totalDocsExamined);
  // Jeśli totalDocsExamined >> docsReturned → potrzebny indeks
  ```

### 3.3 TTL indexes

Dla danych tymczasowych:
```typescript
// Automatyczne usuwanie expired giveaways (po 30 dniach od zakończenia):
@index({ endedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })
endedAt?: Date;
```

---

## 4. QUERY PATTERNS

### 4.1 Pagination

```typescript
// ZAWSZE paginacja dla potencjalnie dużych kolekcji:
const PAGE_SIZE = 25;

async function listQuestions(
  guildId: string,
  page: number = 0
): Promise<ServiceResult<IQuestion[]>> {
  const questions = await QuestionModel
    .find({ guildId, disabled: false })
    .sort({ createdAt: -1 })
    .skip(page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();    // lean() = 2-3x szybsze, zwraca plain objects

  return { ok: true, data: questions };
}
```

### 4.2 Lean queries

```typescript
// Używaj .lean() gdy:
// - Tylko czytasz dane (nie używasz Mongoose methods jak .save())
// - Zwracasz do API lub przetważasz w serwisie

const questions = await QuestionModel.find({ guildId }).lean();  // ✅ szybkie
const question = await QuestionModel.findById(id);               // ✅ potrzebujesz .save()
```

### 4.3 Atomic updates

```typescript
// ZAWSZE atomic update zamiast read-modify-write:
// ❌ Race condition:
const user = await XPModel.findOne({ guildId, userId });
user.xp += 10;
await user.save();

// ✅ Atomic:
const user = await XPModel.findOneAndUpdate(
  { guildId, userId },
  { $inc: { xp: 10 }, $set: { lastMessage: new Date() } },
  { upsert: true, new: true }  // new: true → zwraca zaktualizowany dokument
);
```

### 4.4 Aggregation pipeline

```typescript
// XP leaderboard:
const leaderboard = await XPModel.aggregate([
  { $match: { guildId } },
  { $sort: { xp: -1 } },
  { $limit: 10 },
  { $project: { userId: 1, xp: 1, level: 1, _id: 0 } },
]);
```

---

## 5. SOFT DELETE

```typescript
// Zamiast .deleteOne() → soft delete:
@prop()
deletedAt?: Date;

// Usuń:
await Model.findOneAndUpdate(
  { _id: id, guildId },
  { $set: { deletedAt: new Date() } }
);

// Listuj aktywne (filter out deleted):
await Model.find({ guildId, deletedAt: null });

// NIGDY nie pokazuj usuniętych danych użytkownikom:
// Zawsze dodaj `deletedAt: null` do filtra
```

Kiedy używać soft delete:
- Dane moderacyjne (bany, warny, tickety) — dla audit trail
- Treści edytowane przez użytkowników (QOTD questions)
- Ustawienia gildii

Kiedy hard delete (`.deleteOne()`):
- Dane tymczasowe (invite cache, temp roles)
- Dane gdzie GDPR deletion jest wymagane (user request)

---

## 6. AUDIT TRAIL

### 6.1 AuditLog model

```typescript
// src/models/AuditLog.ts
@modelOptions({ schemaOptions: { timestamps: true, collection: 'audit_logs' } })
@index({ guildId: 1, createdAt: -1 })
@index({ guildId: 1, targetId: 1 })
export class AuditLog {
  @prop({ required: true, index: true })
  guildId!: string;

  @prop({ required: true })
  actorId!: string;          // kto wykonał akcję

  @prop({ required: true, enum: Object.values(ModAction) })
  action!: ModAction;

  @prop({ required: true })
  targetId!: string;         // na kim / na czym

  @prop({ trim: true, maxlength: 1000 })
  reason?: string;

  @prop({ type: () => Object })
  metadata?: Record<string, unknown>;  // dodatkowe dane akcji
}
```

### 6.2 Kiedy zapisywać audit log

ZAWSZE dla:
- Ban, kick, mute, unmute, warn
- Usunięcie pytania QOTD
- Zamknięcie/usunięcie ticketu
- Zmiana konfiguracji gildii (kto i co zmienił)
- Przyznanie/odebranie roli

### 6.3 Immutability

Audit logi NIGDY nie są edytowane ani usuwane programowo. Tylko Atlas admin może ręcznie usunąć (incident recovery).

---

## 7. CONNECTION MANAGEMENT

### 7.1 Singleton connection (bot)

```typescript
// src/index.ts
await mongoose.connect(config.mongoUri, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,           // max 10 concurrent connections
  minPoolSize: 2,            // utrzymuj min 2 połączenia
});

// Nasłuchuj na błędy połączenia:
mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error', { error: err.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected — mongoose will retry');
});
```

### 7.2 Dashboard (inline per-route)

```typescript
// Dashboard używa osobnego połączenia per-route (cached przez Next.js)
// NIE twórz nowych połączeń w każdym render — używaj global connection
const cached = (global as any).__mongoose;
if (!cached.conn) {
  cached.conn = await mongoose.connect(process.env.MONGODB_URI!);
}
```

---

## 8. BEZPIECZEŃSTWO BAZY

### 8.1 MongoDB Atlas configuration

- **IP Access List**: tylko VPS IP + localhost (testy CI)
- **Database user**: read/write tylko na `deezybot` database — brak admin uprawnień
- **Network encryption**: TLS wymagany (Atlas default)
- **Encryption at rest**: Atlas Cloud Backups z encryption (default)

### 8.2 NoSQL Injection prevention

```typescript
// Mongoose global option:
mongoose.set('sanitizeFilter', true);
// Usuwa potencjalnie niebezpieczne operatory ($where, $regex) z filtrów

// NIGDY nie przekazuj surowego body do findOne/find:
await Model.findOne(req.body);  // ❌ może zawierać { $where: ... }
await Model.findOne({ guildId: req.body.guildId });  // ✅ konkretne pole
```

### 8.3 Sensitive data handling

```typescript
// Nigdy nie zwracaj pełnego dokumentu z wrażliwymi polami:
const config = await GuildConfig.findOne({ guildId })
  .select('-__v -_id')          // usuń pola wewnętrzne
  .lean();

// Nigdy nie przechowuj w MongoDB:
// - Bot token
// - Discord OAuth access tokens (są w NextAuth JWT)
// - Hasła (nie ma haseł w projekcie — Discord OAuth)
```

---

## 9. MIGRACJE

Mongoose nie ma wbudowanego systemu migracji. Podejście:

### 9.1 Additive changes (bezpieczne — brak migracji)

```typescript
// Dodanie nowego pola z default value:
@prop({ default: false })
newField?: boolean;
// Stare dokumenty dostaną `undefined` → default w schema działa

// Dodanie nowego indexu:
@index({ guildId: 1, newField: 1 })
// Mongoose tworzy index automatycznie przy następnym połączeniu
```

### 9.2 Breaking changes (wymagają migration script)

```typescript
// src/scripts/migrations/renameField.ts
import mongoose from 'mongoose';
import { config } from '../config';

async function migrate(): Promise<void> {
  await mongoose.connect(config.mongoUri);

  const result = await mongoose.connection.collection('guild_configs').updateMany(
    { oldFieldName: { $exists: true } },
    {
      $rename: { oldFieldName: 'newFieldName' },
    }
  );

  console.log(`Migrated ${result.modifiedCount} documents`);
  await mongoose.disconnect();
}

migrate().catch(console.error);
```

Uruchomienie przed deploym:
```bash
npx tsx src/scripts/migrations/renameField.ts
```

### 9.3 Migration checklist

- [ ] Backup (Atlas snapshot) przed migracją
- [ ] Przetestuj migration script na kopi (Atlas atlas restore → test environment)
- [ ] Uruchom migration przed deploym nowego kodu
- [ ] Zweryfikuj poprawność danych po migracji
- [ ] Zachowaj migration script w historii Git
</content>
</invoke>