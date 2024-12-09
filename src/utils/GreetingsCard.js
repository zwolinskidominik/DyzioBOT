const { JSX, Builder, loadImage } = require("canvacord");
const path = require("path");

class GreetingsCard extends Builder {
  constructor() {
    super(930, 280);
    this.bootstrap({
      displayName: "",
      type: "welcome",
      avatar: "",
      message: "",
      backgroundImage: path.join(__dirname, "../../assets/bg.jpg"),
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
    const { type, displayName, avatar, message, backgroundImage } =
      this.options.getOptions();

    const loadedAvatar = await loadImage(avatar);
    const loadedBackground = await loadImage(backgroundImage);

    const displayNameColor = type === "welcome" ? "#86c232" : "#FF0000";

    return JSX.createElement(
      "div",
      {
        className:
          "h-full w-full flex flex-col items-center justify-center bg-[#23272A] rounded-xl",
        style: {
          backgroundImage: `url(${loadedBackground.toDataURL()})`,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        },
      },
      JSX.createElement(
        "div",
        {
          className:
            "px-6 bg-[#2B2F35] w-[96%] h-[84%] rounded-lg flex items-center",
          style: {
            opacity: 0.95,
          },
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
            ", ",
            " ",
            JSX.createElement(
              "span",
              { className: `text-[${displayNameColor}]` },
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
