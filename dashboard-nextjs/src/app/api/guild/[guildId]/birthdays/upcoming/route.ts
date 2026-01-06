import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";

const birthdaySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  date: { type: Date, required: true },
  yearSpecified: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
}, {
  collection: 'birthdays'
});

if (mongoose.models.UpcomingBirthday) {
  delete mongoose.models.UpcomingBirthday;
}

const Birthday = mongoose.model("UpcomingBirthday", birthdaySchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

function getDaysUntilBirthday(day: number, month: number): number {
  const today = new Date();
  const currentYear = today.getFullYear();
  
  let birthdayThisYear = new Date(currentYear, month - 1, day);
  
  if (birthdayThisYear < today) {
    birthdayThisYear = new Date(currentYear + 1, month - 1, day);
  }
  
  const diffTime = birthdayThisYear.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
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
    
    const birthdaysWithDays = await Promise.all(
      birthdays
        .filter(birthday => birthday.date)
        .map(async (birthday) => {
        const birthdayDate = new Date(birthday.date);
        const day = birthdayDate.getDate();
        const month = birthdayDate.getMonth() + 1;
        const year = birthdayDate.getFullYear();
        const daysUntil = getDaysUntilBirthday(day, month);
        
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
            const userData = await response.json();
            return {
              userId: birthday.userId,
              username: userData.username,
              discriminator: userData.discriminator,
              avatar: userData.avatar,
              day,
              month,
              year,
              daysUntil,
            };
          }
        } catch (error) {
          console.error(`Failed to fetch user ${birthday.userId}:`, error);
        }

        return {
          userId: birthday.userId,
          username: null,
          discriminator: null,
          avatar: null,
          day,
          month,
          year,
          daysUntil,
        };
      })
    );

    const upcomingBirthdays = birthdaysWithDays
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 10);

    return NextResponse.json(upcomingBirthdays);
  } catch (error) {
    console.error("Error fetching upcoming birthdays:", error);
    return NextResponse.json(
      { error: "Failed to fetch upcoming birthdays" },
      { status: 500 }
    );
  }
}
