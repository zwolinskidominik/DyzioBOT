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
      muteReason: "",
      author: "",
      displayNameFont: "",
      messageFont: "",
      reasonFont: "",
      authorFont: "",
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

  setMuteReason(value) {
    this.options.set("muteReason", value);
    return this;
  }

  setAuthor(value) {
    this.options.set("author", value);
    return this;
  }

  setDisplayNameFont(fontAlias) {
    this.options.set("displayNameFont", fontAlias);
    return this;
  }

  setMessageFont(fontAlias) {
    this.options.set("messageFont", fontAlias);
    return this;
  }

  setReasonFont(fontAlias) {
    this.options.set("reasonFont", fontAlias);
    return this;
  }

  setAuthorFont(fontAlias) {
    this.options.set("authorFont", fontAlias);
    return this;
  }

  async render() {
    const {
      displayName,
      avatar,
      message,
      reason,
      muteReason,
      author,
      displayNameFont,
      messageFont,
      reasonFont,
      authorFont,
    } = this.options.getOptions();
    const image = await loadImage(avatar);

    return JSX.createElement(
      "div",
      {
        className:
          "h-full w-full flex flex-col items-center justify-center bg-[#2B2D31] rounded-xl p-8",
      },
      JSX.createElement(
        "div",
        {
          className:
            "bg-[#121212] w-full h-full rounded-lg flex flex-col items-center justify-center p-2",
        },
        JSX.createElement(
          "div",
          {
            className: "w-full flex flex-row items-center justify-center mb-4",
          },
          JSX.createElement("img", {
            src: image.toDataURL(),
            className: "h-[90px] w-[90px] rounded-full mr-4",
          }),
          JSX.createElement(
            "h1",
            {
              className: "text-4xl text-white",
              style: { fontFamily: displayNameFont.name },
            },
            displayName
          )
        ),
        JSX.createElement(
          "div",
          {
            className:
              "w-full flex flex-col items-center justify-center text-center text-white",
          },
          JSX.createElement(
            "p",
            {
              className: "text-3xl text-[#FF0000] m-0",
              style: { fontFamily: messageFont.name },
            },
            message
          ),
          JSX.createElement(
            "p",
            {
              className: "text-2xl mt-2",
              style: { fontFamily: reasonFont.name },
            },
            `Powód: ${reason}`
          ),
          JSX.createElement(
            "p",
            {
              className: "text-2xl my-2",
              style: { fontFamily: reasonFont.name },
            },
            `${muteReason}`
          ),
          JSX.createElement(
            "p",
            {
              className: "text-lg mt-4",
              style: { fontFamily: authorFont.name },
            },
            `Przez: ${author}`
          )
        )
      )
    );
  }
}

module.exports = { WarnCard };
