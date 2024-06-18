const { JSX, Builder, loadImage } = require("canvacord");

class WarnCard extends Builder {
  constructor() {
    super(800, 400);
    this.bootstrap({
      displayName: "",
      type: "goodbye",
      avatar: "",
      message: "",
      reason: "",
      author: "",
    });
  }

  setDisplayName(value) {
    this.options.set("displayName", value);
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

  setReason(value) {
    this.options.set("reason", value);
    return this;
  }

  setAuthor(value) {
    this.options.set("author", value);
    return this;
  }

  async render() {
    const { displayName, avatar, message, reason, author } =
      this.options.getOptions();
    const image = await loadImage(avatar);

    return JSX.createElement(
      "div",
      {
        className:
          "h-full w-full flex flex-col items-center justify-center bg-[#2D2D2D] rounded-xl",
      },
      JSX.createElement(
        "div",
        {
          className:
            "bg-[#121212] w-[90%] h-[80%] rounded-lg flex flex-col items-center justify-center",
        },
        JSX.createElement(
          "div",
          {
            className: "w-full flex flex-row items-center justify-center my-6",
          },
          JSX.createElement("img", {
            src: image.toDataURL(),
            className: "h-[100px] w-[100px] rounded-full mr-4",
          }),
          JSX.createElement(
            "h1",
            { className: "text-4xl text-white font-bold" },
            displayName
          )
        ),
        JSX.createElement(
          "div",
          {
            className: "w-full flex flex-col items-center justify-center",
          },
          JSX.createElement(
            "p",
            { className: "text-3xl text-white text-center m-0" },
            message
          ),
          JSX.createElement(
            "p",
            { className: "text-2xl text-white text-center m-0" },
            `Powód: ${reason}`
          ),
          JSX.createElement(
            "p",
            { className: "font-bold text-base text-white text-center" },
            `Przez: ${author}`
          )
        )
      )
    );
  }
}

module.exports = { WarnCard };
