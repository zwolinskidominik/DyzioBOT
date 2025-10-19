const createdChannels: any[] = [];
class MockCategory {}
const sentMessages: any[] = [];

jest.mock('discord.js', () => {
  class ButtonBuilder { _d:any = {}; setCustomId(id:string){ this._d.customId=id; return this;} setLabel(l:string){this._d.label=l; return this;} setStyle(s:any){this._d.style=s; return this;} setEmoji(e:string){this._d.emoji=e; return this;} setDisabled(v:boolean){this._d.disabled=v; return this;} }
  class ActionRowBuilder { components:any[]=[]; addComponents(...c:any[]){ this.components.push(...c); return this;} }
  return {
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle: { Primary:1, Danger:2, Secondary:3 },
    ChannelType: { GuildText:0 },
    PermissionFlagsBits: {},
    AttachmentBuilder: class { constructor(public path:string){} },
    MessageFlags: { Ephemeral: 64 },
    CategoryChannel: MockCategory,
  };
});

const errorLog = jest.fn();
const warnLog = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { error: (...a:any)=>errorLog(a.join? a.join(' '): a), warn: (...a:any)=>warnLog(a.join? a.join(' '): a) } }));

jest.mock('../../../../src/config/guild', () => ({ getGuildConfig: () => ({ roles: { owner:'ownerR', admin:'adminR', mod:'modR', partnership:'partnerR' } }) }));

jest.mock('../../../../src/utils/embedHelpers', () => ({ createBaseEmbed: (o:any)=> ({ ...o, addFields(){return this;}, setTimestamp(){return this;} }) }));

const ticketConfigFindOne = jest.fn();
jest.mock('../../../../src/models/TicketConfig', () => ({ TicketConfigModel: { findOne: () => ticketConfigFindOne() } }));
const ticketStateFindOne = jest.fn();
const ticketStateFindOneAndUpdate = jest.fn();
const ticketStateFindOneAndDelete = jest.fn();
jest.mock('../../../../src/models/TicketState', () => ({ TicketStateModel: { findOne: (...a:any[])=> ticketStateFindOne(...a), findOneAndUpdate: (...a:any[])=> ticketStateFindOneAndUpdate(...a), findOneAndDelete: (...a:any[])=> ticketStateFindOneAndDelete(...a) } }));
const ticketStatsFindOneAndUpdate = jest.fn();
jest.mock('../../../../src/models/TicketStats', () => ({ TicketStatsModel: { findOneAndUpdate: (...a:any[])=> ticketStatsFindOneAndUpdate(...a) } }));

import run from '../../../../src/events/interactionCreate/ticketSystem';

function makeSelectInteraction(options: { value?: string, config?: any, createError?: boolean } = {}) {
  const value = options.value || 'help';
  ticketConfigFindOne.mockResolvedValue(options.config);
  const category = new (require('discord.js').CategoryChannel)();
  const createdChannelMessages: any[] = [];
  const createdChannel = { send: jest.fn(async (p:any)=> { createdChannelMessages.push(p); sentMessages.push(p); }) };
  const guild = {
    id: 'guild1',
    iconURL: () => 'icon-url',
    channels: {
      cache: { get: (id:string) => id === 'cat1' ? category : undefined },
      create: jest.fn(async () => { if(options.createError) throw new Error('createFail'); createdChannels.push(createdChannel); return createdChannel; })
    }
  };
  const ir: any = {
    isStringSelectMenu: () => true,
    isButton: () => false,
    customId: 'ticket-menu',
    values: [value],
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    guild,
    user: { id: 'u1', username: 'User1', tag: 'User1#0001', displayAvatarURL: ()=>'url', displayAvatarURL2: ()=>'url' },
  };
  return { interaction: ir, guild, createdChannel, createdChannelMessages };
}

function makeButtonInteraction(customId: string, opts: any = {}) {
  const channelName = opts.channelName || 'help-user1';
  const messageComponents = opts.messageComponents || [ { components: [ { type:2, customId: 'zajmij-zgloszenie', label:'Zajmij zgłoszenie', style:1 } ] } ];
  const channel:any = {
    name: channelName,
    id: 'chan1',
    delete: jest.fn(async ()=>{})
  };
  const memberRolesEntries = (opts.roleIds||[]).map((r:string)=> [r,{ id:r }]);
  const rolesArray = memberRolesEntries.map(e=> e[1]);
  const rolesCache = {
    some: (fn:Function) => rolesArray.some(fn),
    get: (id:string) => memberRolesEntries.find(e=> e[0]===id)?.[1],
  } as any;
  const ir: any = {
    isStringSelectMenu: () => false,
    isButton: () => true,
    customId,
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    guild: { id: 'guild1' },
    user: { id: 'u1', username: 'user1' },
  member: { roles: { cache: rolesCache }, user: { username: 'user1' } },
    channel,
    message: { components: messageComponents, edit: jest.fn().mockResolvedValue(undefined) },
  };
  return ir;
}

describe('interactionCreate/ticketSystem', () => {
  beforeEach(() => {
    jest.useRealTimers();
    createdChannels.length = 0; sentMessages.length = 0;
    ticketConfigFindOne.mockReset(); errorLog.mockReset(); warnLog.mockReset();
    ticketStateFindOne.mockReset(); ticketStateFindOneAndUpdate.mockReset(); ticketStateFindOneAndDelete.mockReset(); ticketStatsFindOneAndUpdate.mockReset();
  });

  test('tworzenie kanału happy path', async () => {
    const { interaction } = makeSelectInteraction({ config: { categoryId: 'cat1' } });
    await run(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Stworzono zgłoszenie') }));
    expect(createdChannels.length).toBe(1);
    expect(sentMessages.length).toBe(3);
  });

  test('brak konfiguracji', async () => {
    const { interaction } = makeSelectInteraction({ config: null });
    await run(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Brak konfiguracji systemu ticketów') }));
  });

  test('TAKE_TICKET bez roli (brak uprawnień)', async () => {
    const ir = makeButtonInteraction('zajmij-zgloszenie', { roleIds: [] });
    await run(ir);
    expect(ir.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Nie masz uprawnień') }));
  });

  test('TAKE_TICKET z rolą staff', async () => {
    ticketStateFindOne.mockResolvedValue({ });
    const ir = makeButtonInteraction('zajmij-zgloszenie', { roleIds: ['modR'] });
    await run(ir);
    expect(ticketStateFindOneAndUpdate).toHaveBeenCalled();
    expect(ticketStatsFindOneAndUpdate).toHaveBeenCalled();
    expect(ir.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('zajął') }));
    const edited = ir.message.edit.mock.calls[0][0];
    expect(edited.components[0].components[0]._d.disabled).toBe(true);
  });

  test('TAKE_TICKET already assigned returns info', async () => {
    ticketStateFindOne.mockResolvedValue({ assignedTo: 'otherUser' });
    const ir = makeButtonInteraction('zajmij-zgloszenie', { roleIds: ['modR'] });
    await run(ir);
    const replyCall = ir.followUp.mock.calls.find((c:any)=> (c[0].content||'').includes('zostało już zajęte'));
    expect(replyCall).toBeTruthy();
    expect(ticketStateFindOneAndUpdate).not.toHaveBeenCalled();
    expect(ticketStatsFindOneAndUpdate).not.toHaveBeenCalled();
  });

  test('TAKE_TICKET error updating button logs error and sends error followUp', async () => {
    ticketStateFindOne.mockResolvedValue({ });
    const ir = makeButtonInteraction('zajmij-zgloszenie', { roleIds: ['modR'], messageComponents: [ { components: [ { type:2, customId: 'zajmij-zgloszenie', label:'Zajmij zgłoszenie', style:1 } ] } ] });
    ir.message.edit.mockImplementation(async ()=> { throw new Error('editFail'); });
    await run(ir);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('Błąd podczas zajmowania ticketu'));
    const errFollow = ir.followUp.mock.calls.find((c:any)=> (c[0].content||'').includes('Wystąpił błąd'));
    expect(errFollow).toBeTruthy();
  });

  test('CLOSE_TICKET brak uprawnień', async () => {
    const ir = makeButtonInteraction('zamknij-zgloszenie', { channelName: 'help-otheruser' });
    await run(ir);
    expect(ir.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Nie masz uprawnień') }));
  });

  test('CLOSE_TICKET creator path', async () => {
    const ir = makeButtonInteraction('zamknij-zgloszenie', { channelName: 'help-user1' });
    await run(ir);
    expect(ir.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Czy na pewno chcesz zamknąć') }));
  });

  test('CONFIRM_CLOSE timer usuwanie kanału i rekordu', async () => {
    jest.useFakeTimers();
    const ir = makeButtonInteraction('potwierdz-zamkniecie');
    await run(ir);
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(ir.channel.delete).toHaveBeenCalled();
    expect(ticketStateFindOneAndDelete).toHaveBeenCalled();
  });

  test('CANCEL_CLOSE usuwa reply', async () => {
    const ir = makeButtonInteraction('anuluj-zamkniecie');
    await run(ir);
    expect(ir.deleteReply).toHaveBeenCalled();
  });

  test('błąd w tworzeniu kanału logowany', async () => {
    const { interaction } = makeSelectInteraction({ config: { categoryId: 'cat1' }, createError: true });
    await run(interaction);
    expect(errorLog).toHaveBeenCalled();
    const editArg = interaction.editReply.mock.calls.find(c=> c[0].content?.includes('Wystąpił błąd'));
    expect(editArg).toBeTruthy();
  });

  test('brak kategorii w konfiguracji', async () => {
    const { interaction } = makeSelectInteraction({ config: { categoryId: 'missingCat' } });
    await run(interaction);
    const msg = interaction.editReply.mock.calls.find(c=> (c[0].content||'').includes('Nie znaleziono kategorii'));
    expect(msg).toBeTruthy();
  });
});
