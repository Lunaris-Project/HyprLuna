const { Gio, GLib } = imports.gi;
import Variable from 'resource:///com/github/Aylur/ags/variable.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import PopupWindow from '../.widgethacks/popupwindow.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { execAsync } = Utils;
const { Box, Button, Label } = Widget;
import { setupCursorHover } from '../.widgetutils/cursorhover.js';
import { MaterialIcon } from '../.commonwidgets/materialicon.js';
import { RoundedCorner } from '../.commonwidgets/cairo_roundedcorner.js';
const elevate = userOptions.asyncGet().etc.widgetCorners ? "record-rounding" : "elevation" ;
// State management
const isRecording = Variable(false);
const isPaused = Variable(false);
const isSilent = Variable(false);
const isScreen = Variable(true);
const isHD = Variable(false);

// Reactive icon components
const RecordIcon = () => Widget.Label({
    className: 'icon-material txt-larger',
    label: isRecording.bind().transform(v =>
        v ? 'stop_circle' : 'screen_record'),
});

const PauseIcon = () => Widget.Label({
    className: 'icon-material txt-larger',
    label: isPaused.bind().transform(v =>
        v ? 'play_arrow' : 'pause'),
});

const QualityIcon = () => Widget.Label({
    className: 'icon-material txt-larger',
    label: isHD.bind().transform(v =>
        v ? 'high_quality' : 'sd'),
});

const AudioIcon = () => Widget.Label({
    className: 'icon-material txt-larger',
    label: isSilent.bind().transform(v =>
        v ? 'volume_off' : 'volume_up'),
});

const ScreenIcon = () => Widget.Label({
    className: 'icon-material txt-larger',
    label: isScreen.bind().transform(v =>
        v ? 'desktop_windows' : 'crop_free'),
});

// Recording control functions
const startRecording = () => {
    isRecording.value = true;
    isPaused.value = false;
    const recordingPath = GLib.get_home_dir() + userOptions.asyncGet().etc.recordingPath || '/Videos/';
    const audio = isSilent.value ? '' : '-a';
    const outputFile = recordingPath + `${Date.now()}.mp4`;
    execAsync(`wf-recorder ${audio} -f "${outputFile}"`)
        .catch(console.error);
};

const togglePauseResume = () => {
    if (!isRecording.value) return;
    const signal = isPaused.value ? '-CONT' : '-STOP';
    execAsync(`killall ${signal} wf-recorder`)
        .then(() => isPaused.value = !isPaused.value)
        .catch(console.error);
};

const stopRecording = () => {
    execAsync('killall wf-recorder')
        .then(() => {
            isRecording.value = false;
            isPaused.value = false;
        })
        .catch(console.error);
};

// Control buttons
const recordButton = Button({
    className: 'recorder-btn-red',
    onClicked: () => isRecording.value ? stopRecording() : startRecording(),
    child: RecordIcon(),
});

const pauseButton = Button({
    className: 'recorder-btn',
    onClicked: togglePauseResume,
    child: PauseIcon(),
});

const qualityButton = Button({
    className: 'recorder-btn',
    onClicked: () => isHD.value = !isHD.value,
    child: QualityIcon(),
});

const audioButton = Button({
    className: 'recorder-btn',
    onClicked: () => isSilent.value = !isSilent.value,
    child: AudioIcon(),
});

const screenButton = Button({
    className: 'recorder-btn',
    onClicked: () => isScreen.value = !isScreen.value,
    child: ScreenIcon(),
});

// Main widget
export default () => PopupWindow({
    name: 'recorder',
    anchor: ['top', 'right', 'bottom'],
    layer: 'top',
    child: Box({
        vpack: 'center',
        vertical: true,
        children: [
            userOptions.asyncGet().etc.widgetCorners ? RoundedCorner('bottomright', {
                hpack: "end",
                className: 'corner corner-colorscheme'
            }) : null,
            Box({
                vpack: 'center',
                className: "recorder-bg " + elevate,
                vertical: true,
                children: [
                    Box({
                        vertical: true,
                        vpack: 'center',
                        spacing: 10,
                        children: [
                            recordButton,
                            pauseButton,
                            qualityButton,
                            audioButton,
                            screenButton,
                        ]
                    })
                ],
            }),
            userOptions.asyncGet().etc.widgetCorners ? RoundedCorner('topright', {
                hpack: "end",
                className: 'corner corner-colorscheme'
            }) : null,
        ],
    }),
});
