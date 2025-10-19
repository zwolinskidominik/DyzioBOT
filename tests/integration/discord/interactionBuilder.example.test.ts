import {
  createChatInputInteraction,
  createButtonInteraction,
  createStringSelectMenuInteraction,
  createChannelSelectMenuInteraction,
  createModalSubmitInteraction,
  InteractionBuilder,
} from '../discord/interactionBuilder';

describe('InteractionBuilder', () => {
  describe('ChatInputCommandInteraction', () => {
    test('should create basic command interaction', () => {
      const interaction = createChatInputInteraction('ping').build();
      
      expect(interaction.commandName).toBe('ping');
      expect(interaction.isChatInputCommand()).toBe(true);
      expect(interaction.isButton()).toBe(false);
      expect(interaction.user.username).toBe('testuser');
      expect(interaction.guild?.name).toBe('Test Guild');
    });

    test('should support fluent API for command with options', () => {
      const interaction = createChatInputInteraction()
        .command('roll')
        .options({
          'max-liczba': 20,
        })
        .user({
          username: 'gamer',
          id: '999888777666555444',
        } as any)
        .build();
      
      expect(interaction.commandName).toBe('roll');
      expect(interaction.options.getInteger('max-liczba')).toBe(20);
      expect(interaction.user.username).toBe('gamer');
      expect(interaction.user.id).toBe('999888777666555444');
    });

    test('should support subcommands', () => {
      const interaction = createChatInputInteraction()
        .command('giveaway')
        .subcommand('create')
        .options({
          nagroda: 'Test Prize',
          czas: '1h',
          zwyciezcy: 1,
        })
        .build();
      
      expect(interaction.commandName).toBe('giveaway');
      expect(interaction.options.getSubcommand()).toBe('create');
      expect(interaction.options.getString('nagroda')).toBe('Test Prize');
    });

    test('should mock interaction methods', async () => {
      const interaction = createChatInputInteraction('ping').build();
      
      // Test deferReply
      await interaction.deferReply();
      expect((interaction as any)._testState.deferred).toBe(true);
      
      // Test reply
      await interaction.reply('Pong!');
      expect((interaction as any)._testState.replied).toBe(true);
      expect((interaction as any)._testState.lastResponse).toBe('Pong!');
      
      // Test ephemeral flag
      const ephemeralInteraction = createChatInputInteraction('secret').build();
      await ephemeralInteraction.deferReply({ ephemeral: true });
      expect((ephemeralInteraction as any)._testState.ephemeral).toBe(true);
    });
  });

  describe('ButtonInteraction', () => {
    test('should create button interaction', () => {
      const interaction = createButtonInteraction('confirm-button').build();
      
      expect(interaction.customId).toBe('confirm-button');
      expect(interaction.isButton()).toBe(true);
      expect(interaction.isChatInputCommand()).toBe(false);
      expect(interaction.component.type).toBe(2); // ComponentType.Button
    });

    test('should support fluent API for button', () => {
      const interaction = createButtonInteraction()
        .customId('ticket-close')
        .user({
          username: 'moderator',
          id: '111222333444555666',
        } as any)
        .guild({
          name: 'Support Server',
        } as any)
        .build();
      
      expect(interaction.customId).toBe('ticket-close');
      expect(interaction.user.username).toBe('moderator');
      expect(interaction.guild?.name).toBe('Support Server');
    });

    test('should mock button interaction methods', async () => {
      const interaction = createButtonInteraction('test-button').build();
      
      // Test deferUpdate
      await interaction.deferUpdate();
      expect((interaction as any)._testState.deferred).toBe(true);
      
      // Test update
      await interaction.update({ content: 'Button clicked!' });
      expect((interaction as any)._testState.replied).toBe(true);
      expect((interaction as any)._testState.lastResponse).toBe('Button clicked!');
    });
  });

  describe('StringSelectMenuInteraction', () => {
    test('should create select menu interaction', () => {
      const interaction = createStringSelectMenuInteraction('ticket-menu', ['help']).build();
      
      expect(interaction.customId).toBe('ticket-menu');
      expect(interaction.values).toEqual(['help']);
      expect(interaction.isStringSelectMenu()).toBe(true);
      expect(interaction.component.type).toBe(3); // ComponentType.StringSelect
    });

    test('should support fluent API for select menu', () => {
      const interaction = createStringSelectMenuInteraction()
        .customId('category-select')
        .values(['bug-report', 'feature-request'])
        .user({
          username: 'reporter',
        } as any)
        .build();
      
      expect(interaction.customId).toBe('category-select');
      expect(interaction.values).toEqual(['bug-report', 'feature-request']);
      expect(interaction.user.username).toBe('reporter');
    });
  });

  describe('ChannelSelectMenuInteraction', () => {
    test('should create channel select menu interaction', () => {
      const interaction = createChannelSelectMenuInteraction('channel-picker', ['123456789']).build();
      
      expect(interaction.customId).toBe('channel-picker');
      expect(interaction.values).toEqual(['123456789']);
      expect(interaction.isChannelSelectMenu()).toBe(true);
      expect(interaction.component.type).toBe(8); // ComponentType.ChannelSelect
    });

    test('should support fluent API for channel select', () => {
      const interaction = createChannelSelectMenuInteraction()
        .customId('greetings-channel-select')
        .values(['555666777888999000'])
        .guild({
          name: 'Configuration Server',
        } as any)
        .build();
      
      expect(interaction.customId).toBe('greetings-channel-select');
      expect(interaction.values).toEqual(['555666777888999000']);
      expect(interaction.guild?.name).toBe('Configuration Server');
    });
  });

  describe('ModalSubmitInteraction', () => {
    test('should create modal submit interaction', () => {
      const interaction = createModalSubmitInteraction('user-form', {
        username: 'newuser',
        email: 'user@example.com',
      }).build();
      
      expect(interaction.customId).toBe('user-form');
      expect(interaction.fields.getTextInputValue('username')).toBe('newuser');
      expect(interaction.fields.getTextInputValue('email')).toBe('user@example.com');
      expect(interaction.isModalSubmit()).toBe(true);
    });

    test('should support fluent API for modal submit', () => {
      const interaction = createModalSubmitInteraction()
        .customId('suggestion-modal')
        .modalFields({
          title: 'Improve Bot Commands',
          description: 'Add more music commands for better user experience',
          category: 'enhancement',
        })
        .user({
          username: 'suggester',
        } as any)
        .build();
      
      expect(interaction.customId).toBe('suggestion-modal');
      expect(interaction.fields.getTextInputValue('title')).toBe('Improve Bot Commands');
      expect(interaction.fields.getTextInputValue('description')).toBe('Add more music commands for better user experience');
      expect(interaction.user.username).toBe('suggester');
    });
  });

  describe('Custom Guild and Channel Data', () => {
    test('should accept custom guild configuration', () => {
      const interaction = createChatInputInteraction('serverinfo')
        .guild({
          id: '987654321098765432',
          name: 'Gaming Community',
          memberCount: 1500,
          ownerId: '111222333444555666',
        } as any)
        .build();
      
      expect(interaction.guild?.name).toBe('Gaming Community');
      expect(interaction.guild?.memberCount).toBe(1500);
      expect(interaction.guild?.ownerId).toBe('111222333444555666');
    });

    test('should accept custom channel configuration', () => {
      const interaction = createChatInputInteraction('channel-info')
        .channel({
          id: '777888999000111222',
          name: 'bot-commands',
          type: 0, // TEXT_CHANNEL
        } as any)
        .build();
      
      expect((interaction.channel as any)?.name).toBe('bot-commands');
      expect(interaction.channel?.id).toBe('777888999000111222');
    });

    test('should accept custom member permissions', () => {
      const interaction = createChatInputInteraction('admin-command')
        .member({
          permissions: {} as any, // Mock permissions
        } as any)
        .build();
      
      expect(interaction.member?.permissions).toBeDefined();
    });
  });

  describe('Generic Builder Usage', () => {
    test('should work with generic InteractionBuilder', () => {
      const builder = new InteractionBuilder();
      const interaction = builder
        .command('test')
        .user({ username: 'testuser' } as any)
        .buildChatInput();
      
      expect(interaction.commandName).toBe('test');
      expect(interaction.user.username).toBe('testuser');
    });

    test('should auto-detect interaction type from builder state', () => {
      // Command interaction (no customId)
      const cmdBuilder = new InteractionBuilder();
      cmdBuilder.command('ping');
      const cmdInteraction = cmdBuilder.build();
      expect(cmdInteraction.isChatInputCommand()).toBe(true);
      
      // Button interaction (customId only)
      const btnBuilder = new InteractionBuilder();
      btnBuilder.customId('test-btn');
      const btnInteraction = btnBuilder.build();
      expect(btnInteraction.isButton()).toBe(true);
      
      // Select menu interaction (customId + values)
      const selectBuilder = new InteractionBuilder();
      selectBuilder.customId('test-select').values(['option1']);
      const selectInteraction = selectBuilder.build();
      expect(selectInteraction.isStringSelectMenu()).toBe(true);
      
      // Modal interaction (customId + fields)
      const modalBuilder = new InteractionBuilder();
      modalBuilder.customId('test-modal').modalFields({ field1: 'value1' });
      const modalInteraction = modalBuilder.build();
      expect(modalInteraction.isModalSubmit()).toBe(true);
    });
  });

  describe('Integration Test Examples', () => {
    test('should simulate real command interaction flow', async () => {
      const interaction = createChatInputInteraction()
        .command('ban')
        .options({
          uzytkownik: {
            id: '999888777666555444',
            username: 'troublemaker',
            bot: false,
          },
          powod: 'Spam and inappropriate behavior',
          'delete-messages': true,
        })
        .user({
          username: 'moderator',
          id: '111222333444555666',
        } as any)
        .build();
      
      // Simulate command execution
      await interaction.deferReply({ ephemeral: true });
      expect((interaction as any)._testState.deferred).toBe(true);
      expect((interaction as any)._testState.ephemeral).toBe(true);
      
      // Simulate processing
      const targetUser = interaction.options.getUser('uzytkownik');
      const reason = interaction.options.getString('powod');
      const deleteMessages = interaction.options.getBoolean('delete-messages');
      
      expect(targetUser?.username).toBe('troublemaker');
      expect(reason).toBe('Spam and inappropriate behavior');
      expect(deleteMessages).toBe(true);
      
      // Simulate response
      await interaction.editReply(`User ${targetUser?.username} has been banned for: ${reason}`);
      expect((interaction as any)._testState.lastResponse).toContain('troublemaker');
      expect((interaction as any)._testState.lastResponse).toContain('Spam and inappropriate behavior');
    });

    test('should simulate component interaction flow', async () => {
      const buttonInteraction = createButtonInteraction()
        .customId('ticket-close')
        .user({
          username: 'support-agent',
          id: '111222333444555666',
        } as any)
        .guild({
          name: 'Support Server',
        } as any)
        .build();
      
      // Simulate button handling
      await buttonInteraction.deferUpdate();
      expect((buttonInteraction as any)._testState.deferred).toBe(true);
      
      // Simulate ticket closure logic
      const channelName = (buttonInteraction.channel as any)?.name || 'ticket-123';
      await buttonInteraction.update({
        content: `🔒 Ticket ${channelName} has been closed by ${buttonInteraction.user.username}`,
        components: [], // Remove components
      });
      
      expect((buttonInteraction as any)._testState.replied).toBe(true);
      expect((buttonInteraction as any)._testState.lastResponse).toContain('closed by support-agent');
    });
  });
});