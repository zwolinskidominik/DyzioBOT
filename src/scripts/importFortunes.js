require("dotenv").config();
const fs = require("fs");
const mongoose = require("mongoose");
const { Fortune } = require("../models/Fortune");

async function importFortunes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Połączono z bazą danych");

    const fortunes = fs
      .readFileSync("fortunes.txt", "utf-8")
      .split("\n")
      .filter((line) => line.trim())
      .map((content) => ({ content }));

    await Fortune.deleteMany({});

    await Fortune.insertMany(fortunes);
    console.log(`Zaimportowano ${fortunes.length} wróżb`);
  } catch (error) {
    console.error("Błąd podczas importowania wróżb:", error);
  } finally {
    await mongoose.disconnect();
  }
}

importFortunes();
