import { Client, ActivityType, PresenceStatusData } from 'discord.js';

export default async function run(client: Client): Promise<void> {
  if (!client.user) {
    return;
  }

  await client.user.setPresence({
    activities: [
      {
        name: '/help',
        type: ActivityType.Playing,
      },
    ],
    status: 'online' as PresenceStatusData,
  });
}
