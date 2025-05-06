import Widget from "resource:///com/github/Aylur/ags/widget.js";
import QuoteWidget from "../../bar/modules/quote.js";
import App from "resource:///com/github/Aylur/ags/app.js";

export const zaWizeCat = Widget.Box({
  hpack: "end", // Align to the right
  vpack: "start", // Align to the top
  vexpand: false, // Prevent expanding vertically
  hexpand: false, // Prevent expanding horizontally
  css: "margin-right: 0px;", // No right margin to stick to the edge
  children: [
    Widget.Box({
      className: 'spacing-h-11', // Increased spacing
      vpack: "center",
      hpack: "end",
      vexpand: true, // Allow vertical expansion for multiple lines
      hexpand: false, // Prevent expanding horizontally
      css: "padding: 10px;", // Added more padding
      child: QuoteWidget()
    }),
    Widget.Button({
      hpack: "end",
      vpack: "start",
      vexpand: false, // Prevent expanding vertically
      hexpand: false, // Prevent expanding horizontally
      child: Widget.Icon({ icon: "9", size: 120 }),
      onClicked: () => App.toggleWindow(`sideright`),
    }),
  ],
});
