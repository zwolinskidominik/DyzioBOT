import mongoose from "mongoose";

export interface IChannelStats {
  guildId: string;
  channels: {
    lastJoined?: {
      channelId?: string;
      template?: string;
    };
    users?: {
      channelId?: string;
      template?: string;
    };
    bots?: {
      channelId?: string;
      template?: string;
    };
    bans?: {
      channelId?: string;
      template?: string;
    };
  };
}

const ChannelStatsSchema = new mongoose.Schema<IChannelStats>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    channels: {
      type: {
        lastJoined: {
          channelId: String,
          template: String,
        },
        users: {
          channelId: String,
          template: String,
        },
        bots: {
          channelId: String,
          template: String,
        },
        bans: {
          channelId: String,
          template: String,
        },
      },
      default: {},
    },
  },
  { timestamps: true }
);

const ChannelStatsModel =
  mongoose.models.ChannelStats ||
  mongoose.model<IChannelStats>("ChannelStats", ChannelStatsSchema);

export default ChannelStatsModel;
