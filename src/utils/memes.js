const axios = require("axios");
const cheerio = require("cheerio");
const logger = require("./logger");

function getDefaultHeaders() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  };
}

function handleFetchError(error, site) {
  if (error.response?.status === 404) {
    logger.warn(`Błąd 404: Nie znaleziono strony dla ${site}`);
    throw new Error(`Strona ${site} zwróciła błąd 404`);
  }
  logger.error(`Błąd podczas pobierania mema z ${site}:`, error);
}

async function parseKwejkRandom() {
  try {
    const { data } = await axios.get("https://kwejk.pl/losowy", {
      headers: getDefaultHeaders(),
    });

    const $ = cheerio.load(data);
    const title =
      $(".media-element-wrapper .content h1").text().trim() || "Kwejk Meme";

    const image = $(".media-element-wrapper .figure-holder img.full-image");
    if (image.length > 0) {
      return { title, url: image.attr("src"), isVideo: false };
    }

    const videoPlayer = $(".video-player-box");
    if (videoPlayer.length > 0) {
      return { title, url: videoPlayer.attr("source"), isVideo: true };
    }

    throw new Error("Nie udało się znaleźć obrazu lub wideo na stronie Kwejk");
  } catch (error) {
    handleFetchError(error, "kwejk");
    throw error;
  }
}

async function parseDemotywatoryRandom() {
  try {
    const { request } = await axios.get("https://demotywatory.pl/losuj", {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 303,
    });

    if (!request.res.headers.location) {
      throw new Error(
        "Nie otrzymano przekierowania z losowej strony Demotywatory"
      );
    }

    const { data } = await axios.get(request.res.headers.location);
    const $ = cheerio.load(data);

    const video = $('video source[type="video/mp4"]');
    if (video.length > 0) {
      return {
        title: $(".demotivator h2").text().trim() || "Demotywatory Meme",
        url: video.attr("src"),
        isVideo: true,
      };
    }

    const image = $(".demotivator img.demot");
    if (image.length === 0) {
      throw new Error(
        "Nie udało się znaleźć obrazu mema na stronie Demotywatory"
      );
    }

    return {
      title: null,
      url: image.attr("src"),
      isVideo: false,
    };
  } catch (error) {
    handleFetchError(error, "demotywatory");
    throw error;
  }
}

async function parseMistrzowieRandom() {
  try {
    const { request } = await axios.get("https://mistrzowie.org/losuj", {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 303,
    });

    if (!request.res.headers.location) {
      throw new Error(
        "Nie otrzymano przekierowania z losowej strony Mistrzowie"
      );
    }

    const { data } = await axios.get(request.res.headers.location);
    const $ = cheerio.load(data);

    const meme = $(".pic_wrapper img");
    if (meme.length === 0) {
      throw new Error("Nie udało się znaleźć mema na stronie Mistrzowie");
    }

    return {
      title: $("h1.picture").text().trim() || "Mistrzowie Meme",
      url: `https://mistrzowie.org${meme.attr("src")}`,
      isVideo: false,
    };
  } catch (error) {
    handleFetchError(error, "mistrzowie");
    throw error;
  }
}

async function parseIvallMemy() {
  const { data } = await axios.get("https://ivall.pl/memy");
  if (!data.url) {
    throw new Error("Nie udało się znaleźć mema na stronie: ivall");
  }
  return {
    title: null,
    url: data.url,
    isVideo: false,
  };
}

const SITES = {
  kwejk: {
    url: "https://kwejk.pl/losowy",
    parser: parseKwejkRandom,
  },
  demotywatory: {
    url: "https://demotywatory.pl/losuj",
    parser: parseDemotywatoryRandom,
  },
  mistrzowie: {
    url: "https://mistrzowie.org/losuj",
    parser: parseMistrzowieRandom,
  },
  ivallmemy: {
    url: "https://ivall.pl/memy",
    parser: parseIvallMemy,
  },
};

/**
 *
 * @param {string} site - nazwa strony z obiektu SITES (kwejk, demotywatory, mistrzowie, ivallmemy)
 * @returns {object} - obiekt meme (title, url, isVideo, source)
 */
const fetchMeme = async (site) => {
  try {
    const siteConfig = SITES[site];
    if (!siteConfig) {
      throw new Error(`Nieznana strona: ${site}`);
    }

    const meme = await siteConfig.parser();

    if (!meme || !meme.url) {
      throw new Error(`Nie udało się znaleźć mema na stronie: ${site}`);
    }

    meme.source = site;
    return meme;
  } catch (error) {
    handleFetchError(error, site);
    throw error;
  }
};

module.exports = { fetchMeme, SITES };
