const quickLaunchItems = [
    {
        "name": "GitHub + Files×2",
        "command": "github-desktop & nautilus --new-window & nautilus --new-window &"
    },
    {
        "name": "Terminal×2",
        "command": "foot & foot &"
    },
    {
        "name": "Discord + Youtube + Github",
        "command": "xdg-open 'https://discord.com/app' && xdg-open 'https://youtube.com/' && xdg-open 'https://github.com/' &"
    },
]

const QuickLaunches = () => Box({
    vertical: true,
    className: 'spacing-v-10',
    children: [
        Label({
            xalign: 0,
            className: 'bg-quicklaunch-title',
            label: 'Quick Launches',
        }),
        Box({
            hpack: 'start',
            className: 'spacing-h-5',
            children: quickLaunchItems.map((item, i) => Button({
                onClicked: () => {
                    execAsync(['bash', '-c', `${item["command"]}`]).catch(print);
                },
                className: 'bg-quicklaunch-btn',
                child: Label({
                    label: `${item["name"]}`,
                }),
                setup: (self) => {
                    setupCursorHover(self);
                }
            })),
        })
    ]
})
export default () => QuickLaunches