let suggestionDoc: any;
const findOne = jest.fn(async () => suggestionDoc);
const error = jest.fn();
const formatResultsSpy = jest.fn(() => 'NOWE_GLOSY');

jest.mock('../../../../src/models/Suggestion', () => ({ SuggestionModel: { findOne: () => findOne() } }));
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { error: (...a:any)=>error(a.map(String).join(' ')) } }));
jest.mock('../../../../src/utils/embedHelpers', () => ({ formatResults: () => 'NOWE_GLOSY' }));

import run from '../../../../src/events/interactionCreate/handleSuggestions';

function baseInteraction(customId: string) {
  const ir: any = {
    isButton: () => true,
    customId,
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    channel: undefined,
    client: { user: { id: 'botId' } },
    guild: { id: 'guild1' },
    user: { id: 'user1', username: 'User1' },
  };
  return ir;
}

function makeTextChannel(messageObj?: any) {
  return {
    messages: {
      fetch: jest.fn(async (id:string) => messageObj || null),
    },
  };
}

describe('interactionCreate/handleSuggestions', () => {
  beforeEach(()=> { findOne.mockClear(); formatResultsSpy.mockClear(); error.mockClear(); });

  test('pierwszy głos (upvote) aktualizuje embed i zapisuje', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    suggestionDoc = { suggestionId: 's1', messageId: 'm1', upvotes: [], downvotes: [], upvoteUsernames: [], downvoteUsernames: [], save };
    const originalEmbed = { fields: [ { name: 'Sugestia', value: 'Tresc' }, { name: 'Głosy', value: 'STARE' } ] };
    const edit = jest.fn().mockResolvedValue(undefined);
    const messageObj = { embeds: [ originalEmbed ], edit };
    const interaction = baseInteraction('suggestion.s1.upvote');
    interaction.channel = makeTextChannel(messageObj);

    await run(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('Oddano głos na tak!');
    expect(save).toHaveBeenCalled();
    expect(edit).toHaveBeenCalled();
    const updatedEmbed = (edit.mock.calls[0][0].embeds[0]);
    expect(updatedEmbed.fields[1].value).toBe('NOWE_GLOSY');
  });

  test('drugi głos (blokada) zwraca komunikat i nie modyfikuje ponownie', async () => {
    const save = jest.fn();
    suggestionDoc = { suggestionId: 's2', messageId: 'm2', upvotes: ['user1'], downvotes: [], upvoteUsernames: ['User1'], downvoteUsernames: [], save };
    const originalEmbed = { fields: [ { name: 'Sugestia', value: 'abc' }, { name: 'Głosy', value: 'OLD' } ] };
    const edit = jest.fn();
    const messageObj = { embeds: [ originalEmbed ], edit };
    const interaction = baseInteraction('suggestion.s2.upvote');
    interaction.channel = makeTextChannel(messageObj);

    await run(interaction as any);
    expect(interaction.editReply).toHaveBeenCalledWith('Oddano już głos na tę sugestię.');
    expect(save).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
  });

  test('brak wiadomości docelowej (kanał bez messages) -> odpowiedni komunikat', async () => {
    const save = jest.fn();
    suggestionDoc = { suggestionId: 's3', messageId: 'm3', upvotes: [], downvotes: [], upvoteUsernames: [], downvoteUsernames: [], save };
    const interaction = baseInteraction('suggestion.s3.upvote');
    interaction.channel = { };
    await run(interaction as any);
    expect(interaction.editReply).toHaveBeenCalledWith('Nie można pobrać wiadomości z tego kanału.');
  });

  test('brak embeda w wiadomości docelowej', async () => {
    const save = jest.fn();
    suggestionDoc = { suggestionId: 's4', messageId: 'm4', upvotes: [], downvotes: [], upvoteUsernames: [], downvoteUsernames: [], save };
    const edit = jest.fn();
    const messageObj = { embeds: [], edit };
    const interaction = baseInteraction('suggestion.s4.downvote');
    interaction.channel = makeTextChannel(messageObj);
    await run(interaction as any);
    expect(interaction.editReply).toHaveBeenCalledWith('Wiadomość docelowa nie zawiera żadnych osadzonych treści.');
    expect(save).not.toHaveBeenCalled();
  });

  test('wiadomość docelowa null', async () => {
    const save = jest.fn();
    suggestionDoc = { suggestionId: 's5', messageId: 'm5', upvotes: [], downvotes: [], upvoteUsernames: [], downvoteUsernames: [], save };
    const interaction = baseInteraction('suggestion.s5.upvote');
    interaction.channel = { messages: { fetch: jest.fn(async ()=> null) } };
    await run(interaction as any);
    expect(interaction.editReply).toHaveBeenCalledWith('Wiadomość docelowa nie zawiera żadnych osadzonych treści.');
    expect(save).not.toHaveBeenCalled();
  });

  test('embed bez drugiego pola powoduje log błędu (catch)', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    suggestionDoc = { suggestionId: 's6', messageId: 'm6', upvotes: [], downvotes: [], upvoteUsernames: [], downvoteUsernames: [], save };
    const brokenEmbed = { fields: [ { name: 'Sugestia', value: 'Coś' } ] };
    const edit = jest.fn();
    const messageObj = { embeds: [ brokenEmbed ], edit };
    const interaction = baseInteraction('suggestion.s6.upvote');
    interaction.channel = makeTextChannel(messageObj);
    await run(interaction as any);
    expect(save).toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Error in handleSuggestion'));
  });

  test('customId nie od sugestii -> skip bez akcji', async () => {
    const interaction: any = baseInteraction('other.123.action');
    await run(interaction);
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
  });
});
