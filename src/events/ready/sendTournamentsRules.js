const cron = require("node-cron");

module.exports = async (client) => {
  cron.schedule("30 19 * * 1", async () => {
    try {
      const tournamentChannel = client.channels.cache.get(
        process.env.TOURNAMENT_CHANNEL_ID
      );

      if (!tournamentChannel) {
        console.error("Kanał do wysyłania zasad turnieju nie istnieje!");
        return;
      }

      const rules = `## Zasady co poniedziałkowego turnieju 5vs5vs15vs20 w CS2 na GameZone
**Do kogo można się zgłaszać z dodatkowymi pytaniami o turniej?** 
**-->** <@&1292916653377720400>: <@518738731105124352> <@416669555075579925> 

> **Zbiórka i start**
> Zbieramy się na **kanale głosowym CS2** o godzinie **20:30** **w każdy poniedziałek**. Do turnieju może dołączyć **każdy** zainteresowany zabawą. Następnie przechodzimy do **losowania drużyn**.

> **Zakaz używania cheatów**
> Używanie jakichkolwiek programów wspomagających jest surowo zabronione. Turniej opiera się na uczciwej rywalizacji i dobrej atmosferze!

> **Dobra zabawa to priorytet**
> Najważniejszym celem turnieju jest wspólna zabawa. Grajmy na luzie i bawmy się tym czasem, bez zbędnej presji.

> **Eksperymentowanie z bronią**
> Zeusy, kosy, granaty oraz wszelkie nietypowe bronie są mile widziane! 

> **Zakaz "tryhardowania"**
> Turniej jest for fun – prosimy, aby unikać przesadnej rywalizacji i "pocenia się" w rozgrywkach. Pamiętajmy, że wszyscy są tu dla rozrywki!

> **Kultura**
> Szanujmy zarówno przeciwników, jak i swoich teammate'ów. Obrażanie, negatywne komentarze lub wyzwiska są zabronione – celem jest pozytywna atmosfera i dobra zabawa.

**Powodzenia i bawcie się dobrze!** 🎮`;

      const rulesMessage = await tournamentChannel.send(rules);

      await rulesMessage.react("🎮");
    } catch (error) {
      console.error("Błąd wysyłania zasad turnieju:", error);
    }
  });
};
