const cron = require("node-cron");
const logger = require("../../utils/logger");

module.exports = async (client) => {
  cron.schedule("30 19 * * 1", async () => {
    try {
      const tournamentChannel = client.channels.cache.get(
        process.env.TOURNAMENT_CHANNEL_ID
      );

      if (!tournamentChannel) {
        logger.warn("Kanał do wysyłania zasad turnieju nie istnieje!");
        return;
      }

      const rules = `## Zasady co poniedziałkowych mix-ów 5vs5vs15vs20 w CS2 na GameZone
      **Do kogo można się zgłaszać z dodatkowymi pytaniami o turniej?** 
      **-->** <@&1292916653377720400>: <@518738731105124352> <@416669555075579925> <@813135633248682064>

      > **Zbiórka i start**
      > Zbieramy się na **kanale głosowym CS2** o godzinie **20:30** **w każdy poniedziałek**. Do turnieju może dołączyć **każdy** zainteresowany rywalizacją i dobrą zabawą. Następnie przechodzimy do **losowania drużyn**.

      > **Zakaz używania cheatów**
      > Używanie jakichkolwiek programów wspomagających jest surowo zabronione. Turniej opiera się na uczciwej rywalizacji i dobrej atmosferze!

      > **Eksperymentowanie z bronią**
      > Zeusy, kosy, granaty oraz wszelkie nietypowe bronie są mile widziane! 

      > **Kultura**
      > Szanujmy zarówno przeciwników, jak i swoich teammate'ów. Obrażanie, negatywne komentarze lub wyzwiska są zabronione – celem jest pozytywna atmosfera i dobra zabawa.
      > 
      > **Klipy i dodatkowe nagrody**
      > Wrzuć swój najlepszy, najzabawniejszy lub najgłupszy (jakikolwiek chcesz – ale tylko JEDEN) klip na kanał #klipy z hashtagiem **#mix**, aby mieć szansę wygrać skina lub klucz do skrzynki! O szczegóły dopytaj <@&1292916653377720400>

      **Powodzenia i bawcie się dobrze!** 🎮`;

      const rulesMessage = await tournamentChannel.send(rules);
      await rulesMessage.react("🎮");
    } catch (error) {
      logger.error(`Błąd wysyłania zasad turnieju: ${error}`);
    }
  });
};
