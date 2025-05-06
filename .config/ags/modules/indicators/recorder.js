const { Gio, GLib } = imports.gi;
import Variable from 'resource:///com/github/Aylur/ags/variable.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import PopupWindow from '../.widgethacks/popupwindow.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import Audio from 'resource:///com/github/Aylur/ags/service/audio.js';
import App from 'resource:///com/github/Aylur/ags/app.js';
const { execAsync } = Utils;
const { Box, Button, Label } = Widget;
import { setupCursorHover } from '../.widgetutils/cursorhover.js';
import { MaterialIcon } from '../.commonwidgets/materialicon.js';
import { RoundedCorner } from '../.commonwidgets/cairo_roundedcorner.js';
const elevate = userOptions.asyncGet().etc.widgetCorners ? "record-rounding" : "elevation" ;

// متغيرات الحالة
const isRecording = Variable(false);
const isPaused = Variable(false);
const isMicEnabled = Variable(true);  // المايكروفون: true = شغال، false = مقفول
const isSystemAudioEnabled = Variable(true); // صوت النظام: true = شغال، false = مقفول
const isScreen = Variable(true);  // حالة التسجيل: true = شاشة كاملة، false = منطقة محددة
const isHD = Variable(false);  // الجودة: true = عالية، false = عادية

// تخزين مسار الملف للاستخدام في الإشعارات
let outputFile = '';

// معرفات مصادر الصوت (ثابتة)
const MICROPHONE_SOURCE = 'alsa_input.pci-0000_00_1f.3.analog-stereo';
const SYSTEM_AUDIO_SOURCE = 'alsa_output.pci-0000_00_1f.3.analog-stereo.monitor';

// الأيقونات
const RecordIcon = () => MaterialIcon(
    isRecording.bind().transform(v => v ? 'stop_circle' : 'video_camera_front'), 
    'large'
);

const PauseIcon = () => MaterialIcon(
    isPaused.bind().transform(v => v ? 'play_arrow' : 'pause'), 
    'large'
);

const QualityIcon = () => MaterialIcon(
    isHD.bind().transform(v => v ? 'high_quality' : 'sd'), 
    'large'
);

const MicrophoneIcon = () => MaterialIcon(
    isMicEnabled.bind().transform(v => v ? 'mic' : 'mic_off'), 
    'large'
);

const ScreenIcon = () => MaterialIcon(
    isScreen.bind().transform(v => v ? 'desktop_windows' : 'crop_free'), 
    'large'
);

const SystemAudioIcon = () => MaterialIcon(
    isSystemAudioEnabled.bind().transform(v => v ? 'volume_up' : 'volume_off'), 
    'large'
);

// إعداد معلمات الأمر بناءً على حالة المتغيرات
const buildRecordingCommand = () => {
    const cmd = ['wf-recorder'];
    const recordingPath = GLib.get_home_dir() + (userOptions.asyncGet().etc.recordingPath || '/Videos/');
    outputFile = recordingPath + `${Date.now()}.mp4`;
    
    // إدارة مصادر الصوت
    if (isMicEnabled.value && isSystemAudioEnabled.value) {
        // إذا كان كل من المايكروفون وصوت النظام مفعلين
        // نستخدم وسيلة "parec" لدمج مصادر الصوت
        // ملاحظة: هذه الطريقة ستتطلب تثبيت حزمة pulseaudio-utils
        // يتم تحديد استخدام الصوت بشكل عام
        cmd.push('-a');
    } else if (isMicEnabled.value) {
        // إذا كان المايكروفون فقط مفعلاً
        cmd.push('--audio=' + MICROPHONE_SOURCE);
    } else if (isSystemAudioEnabled.value) {
        // إذا كان صوت النظام فقط مفعلاً
        cmd.push('--audio=' + SYSTEM_AUDIO_SOURCE);
    }
    
    // إضافة خيارات الجودة
    if (isHD.value) {
        cmd.push('--codec=libx264');
        // خيارات أبسط لتجنب مشاكل التحليل
        cmd.push('-p');
        cmd.push('tune=zerolatency');
    }
    
    // إضافة مسار الملف الناتج
    cmd.push('-f');
    cmd.push(outputFile);
    
    return cmd;
};

// تحديث الإشعارات بحيث تعكس حالة الإعدادات بدقة
const showRecordingNotification = () => {
    // تحضير تفاصيل الإشعار
    const details = [];
    
    // إظهار حالة المايكروفون
    details.push(`Microphone: ${isMicEnabled.value ? 'ON' : 'OFF'}`);
    
    // إظهار حالة صوت النظام
    details.push(`System Audio: ${isSystemAudioEnabled.value ? 'ON' : 'OFF'}`);
    
    // إظهار حالة الجودة
    details.push(`Quality: ${isHD.value ? 'HD' : 'Standard'}`);
    
    // إظهار وضع التسجيل
    details.push(`Mode: ${isScreen.value ? 'Full Screen' : 'Area Selection'}`);
    
    // إظهار مسار الملف
    details.push(`Saving to: ${outputFile}`);
    
    // إرسال الإشعار مع أيقونة مناسبة
    execAsync(`notify-send "Recording started" "${details.join('\n')}" -i video-display`)
        .catch(console.error);
};

// بدء التسجيل
const startRecording = () => {
    isRecording.value = true;
    isPaused.value = false;
    
    // إعداد معلمات الأمر الأساسية
    const cmd = buildRecordingCommand();
    
    // إغلاق واجهة الريكوردر قبل البدء في التسجيل
    App.closeWindow('recorder');
    
    // منطق مختلف بناءً على وضع التسجيل (شاشة كاملة أو منطقة محددة)
    if (!isScreen.value) {
        // إذا كان وضع تحديد منطقة، اعرض أداة التحديد أولاً
        execAsync(`notify-send "Area Selection" "Select an area to record" -i video-display`)
            .then(() => {
                // استخدام slurp لاختيار منطقة
                return execAsync(['slurp']).then(geometry => {
                    // إضافة الهندسة المحددة إلى أمر wf-recorder
                    cmd.push('-g');
                    cmd.push(geometry.trim());
                    
                    console.log("Record command (area):", cmd.join(' '));
                    
                    // إظهار إشعار ببدء التسجيل بعد اختيار المنطقة
                    showRecordingNotification();
                    
                    return execAsync(cmd);
                });
            })
            .catch(error => {
                console.error("Failed to start recording:", error);
                execAsync(`notify-send "Recording failed" "Error: ${error}" -i error`);
                isRecording.value = false;
            });
    } else {
        // وضع تسجيل الشاشة الكاملة
        console.log("Record command (fullscreen):", cmd.join(' '));
        
        execAsync(cmd)
            .catch(error => {
                console.error("Failed to start recording:", error);
                execAsync(`notify-send "Recording failed" "Error: ${error}" -i error`);
                isRecording.value = false;
            });
            
        // إظهار إشعار ببدء التسجيل فوراً في وضع الشاشة الكاملة
        showRecordingNotification();
    }
};

// توقف مؤقت/استئناف التسجيل
const togglePauseResume = () => {
    if (!isRecording.value) return;
    
    const signal = isPaused.value ? '-CONT' : '-STOP';
    execAsync(`killall ${signal} wf-recorder`)
        .then(() => isPaused.value = !isPaused.value)
        .catch(console.error);
    
    const message = isPaused.value ? "Recording paused" : "Recording resumed";
    execAsync(`notify-send "${message}" "Recording to ${outputFile}" -i video-display`)
        .catch(console.error);
};

// إيقاف التسجيل
const stopRecording = () => {
    if (!isRecording.value) return;
    
    execAsync('killall wf-recorder')
        .then(() => {
            isRecording.value = false;
            isPaused.value = false;
            // إرسال إشعار بإيقاف التسجيل
            return execAsync(`notify-send "Recording stopped" "Saved to ${outputFile}" -i video-display`);
        })
        .catch(console.error);
};

// تبديل حالة صوت النظام
const toggleSystemAudio = () => {
    isSystemAudioEnabled.value = !isSystemAudioEnabled.value;
    
    const message = isSystemAudioEnabled.value ? 
        "System audio enabled" : 
        "System audio disabled";
    
    execAsync(`notify-send "${message}" "System audio will ${isSystemAudioEnabled.value ? '' : 'NOT'} be recorded" -i ${isSystemAudioEnabled.value ? 'audio-volume-high' : 'audio-volume-muted'}`)
        .catch(console.error);
        
    // إذا كان التسجيل قيد التشغيل، أخبر المستخدم أن التغيير سيؤثر على التسجيل التالي
    if (isRecording.value) {
        execAsync(`notify-send "Note" "System audio changes will apply to next recording" -i info`)
            .catch(console.error);
    }
};

// تبديل حالة المايكروفون
const toggleMicrophone = () => {
    isMicEnabled.value = !isMicEnabled.value;
    
    const message = isMicEnabled.value ? "Microphone enabled" : "Microphone disabled";
    const icon = isMicEnabled.value ? "audio-input-microphone" : "microphone-disabled";
    
    execAsync(`notify-send "${message}" "Microphone will ${isMicEnabled.value ? '' : 'NOT'} be used in recording" -i ${icon}`)
        .catch(console.error);
        
    // إذا كان التسجيل قيد التشغيل، أخبر المستخدم أن التغيير سيؤثر على التسجيل التالي
    if (isRecording.value) {
        execAsync(`notify-send "Note" "Microphone changes will apply to next recording" -i info`)
            .catch(console.error);
    }
};

// تغيير حالة جودة التسجيل وإرسال إشعار
const toggleQuality = () => {
    isHD.value = !isHD.value;
    
    const message = isHD.value ? "High quality enabled" : "Standard quality enabled";
    execAsync(`notify-send "${message}" "Recording will be in ${isHD.value ? 'high' : 'standard'} quality" -i preferences-desktop-display`)
        .catch(console.error);
    
    // تطبيق إعدادات الجودة العالية إذا كان التسجيل جارياً
    if (isRecording.value) {
        execAsync(`notify-send "Note" "Quality changes will apply to next recording" -i info`)
            .catch(console.error);
    }
};

// تغيير وضع التسجيل وإرسال إشعار
const toggleScreenMode = () => {
    isScreen.value = !isScreen.value;
    
    const message = isScreen.value ? "Full screen mode" : "Area selection mode";
    execAsync(`notify-send "${message}" "Recording will capture ${isScreen.value ? 'entire screen' : 'selected area'}" -i video-display`)
        .catch(console.error);
    
    // إذا كان التسجيل جارياً، أخبر المستخدم أن التغيير سيطبق في التسجيل التالي
    if (isRecording.value) {
        execAsync(`notify-send "Note" "Screen mode changes will apply to next recording" -i info`)
            .catch(console.error);
    }
};

// أزرار التحكم
const recordButton = Button({
    className: 'recorder-btn-red',
    onClicked: () => isRecording.value ? stopRecording() : startRecording(),
    child: RecordIcon(),
    tooltipText: 'Start/Stop recording',
    setup: setupCursorHover,
});

const pauseButton = Button({
    className: 'recorder-btn',
    onClicked: togglePauseResume,
    child: PauseIcon(),
    tooltipText: 'Pause/Resume recording',
    setup: setupCursorHover,
});

const qualityButton = Button({
    className: 'recorder-btn',
    onClicked: toggleQuality,
    child: QualityIcon(),
    tooltipText: 'Toggle recording quality',
    setup: setupCursorHover,
});

const microphoneButton = Button({
    className: 'recorder-btn',
    onClicked: toggleMicrophone,
    child: MicrophoneIcon(),
    tooltipText: 'Toggle microphone',
    setup: setupCursorHover,
});

const screenButton = Button({
    className: 'recorder-btn',
    onClicked: toggleScreenMode,
    child: ScreenIcon(),
    tooltipText: 'Toggle screen/area recording',
    setup: setupCursorHover,
});

const systemAudioButton = Button({
    className: 'recorder-btn',
    onClicked: toggleSystemAudio,
    child: SystemAudioIcon(),
    tooltipText: 'Toggle system audio recording',
    setup: setupCursorHover,
});

// تصدير نافذة التسجيل
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
                css: `
                    .recorder-btn, .recorder-btn-red {
                        min-width: 48px;
                        min-height: 48px;
                        margin: 4px;
                        border-radius: 24px;
                    }
                `,
                children: [
                    Box({
                        vertical: true,
                        vpack: 'center',
                        spacing: 10,
                        children: [
                            recordButton,
                            pauseButton,
                            qualityButton,
                            microphoneButton,
                            screenButton,
                            systemAudioButton,
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
