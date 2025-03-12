import Widget from "resource:///com/github/Aylur/ags/widget.js";
import QuoteWidget from "../../bar/modules/quote.js";

export const zaWiseCat = Widget.Box({
  vpack:"start",
  children: [
    Widget.Box({child:QuoteWidget(),vpack:"center"}),
    Widget.Button({
      vpack:"center",
      child:Widget.Icon({icon:'9',size: 120,}),
      onClicked: () =>App.toggleWindow(`sideright`)
    })
  ]
})