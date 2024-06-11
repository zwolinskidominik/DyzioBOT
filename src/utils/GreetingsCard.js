const { JSX, Builder, loadImage } = require("canvacord");
const path = require('path');

class GreetingsCard extends Builder {
  constructor() {
    super(930, 280);
    this.bootstrap({
      displayName: "",
      type: "welcome",
      avatar: "",
      message: "",
      backgroundImage: path.join(__dirname, '../resources/img/bg.jpg'),
    });
  }

  setDisplayName(value) {
    this.options.set("displayName", value);
    return this;
  }

  setType(value) {
    this.options.set("type", value);
    return this;
  }

  setAvatar(value) {
    this.options.set("avatar", value);
    return this;
  }

  setMessage(value) {
    this.options.set("message", value);
    return this;
  }

  async render() {
    const { type, displayName, avatar, message, backgroundImage } = this.options.getOptions();

    const loadedAvatar = await loadImage(avatar);
    const loadedBackground = await loadImage(backgroundImage);

    return JSX.createElement(
      "div",
      {
        className:
          "h-full w-full flex flex-col items-center justify-center bg-[#23272A] rounded-xl",
          style: {
            backgroundImage: `url(${loadedBackground.toDataURL()})`,
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
          }
        },
      JSX.createElement(
        "div",
        {
          className:
            "px-6 bg-[#2B2F35AA] w-[96%] h-[84%] rounded-lg flex items-center",
        },
        JSX.createElement("img", {
          src: loadedAvatar.toDataURL(),
          className: "flex h-[40] w-[40] rounded-full",
        }),
        JSX.createElement(
          "div",
          { className: "flex flex-col ml-6" },
          JSX.createElement(
            "h1",
            { className: "text-5xl text-white font-bold m-0" },
            type === "welcome" ? "Cześć" : "Żegnaj",
            ",",
            " ",
            JSX.createElement(
              "span",
              { className: "text-blue-500" },
              displayName,
              "!"
            )
          ),
          JSX.createElement(
            "p",
            { className: "text-gray-300 text-3xl m-0" },
            message
          )
        )
      )
    );
  }
}

module.exports = { GreetingsCard };
