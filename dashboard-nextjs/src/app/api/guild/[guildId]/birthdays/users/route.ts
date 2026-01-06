import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";

const birthdaySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  day: { type: Number, required: true },
  month: { type: Number, required: true },
  year: { type: Number },
}, {
  collection: 'birthdays'
});

if (mongoose.models.Birthday) {
  delete mongoose.models.Birthday;
}

const Birthday = mongoose.model("Birthday", birthdaySchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    await connectDB();

    const birthdays = await Birthday.find({ guildId: String(guildId) }).lean();
    
    const birthdaysWithUsers = await Promise.all(
      birthdays.map(async (birthday) => {
        try {
          const response = await fetch(
            `https://discord.com/api/v10/users/${birthday.userId}`,
            {
              headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              },
            }
          );
          
          if (response.ok) {
            const user = await response.json();
            return {
              ...birthday,
              username: user.username,
              discriminator: user.discriminator,
              avatar: user.avatar,
            };
          }
        } catch (error) {}
        return birthday;
      })
    );
    
    return NextResponse.json(birthdaysWithUsers);
  } catch (error) {
    console.error("Error fetching birthdays:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await connectDB();

    await Birthday.findOneAndDelete({ guildId: String(guildId), userId: String(userId) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting birthday:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const data = await request.json();

    await connectDB();

    const birthday = await Birthday.findOneAndUpdate(
      { guildId: String(guildId), userId: String(data.userId) },
      {
        guildId: String(guildId),
        userId: String(data.userId),
        day: data.day,
        month: data.month,
        year: data.year,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(birthday);
  } catch (error) {
    console.error("Error updating birthday:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
