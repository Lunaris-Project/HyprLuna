const { Gtk, Pango } = imports.gi;
import App from 'resource:///com/github/Aylur/ags/app.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import GLib from 'gi://GLib';

const { Box, Button, Icon, Label, Revealer, Scrollable } = Widget;
import GeminiService from '../../../services/gemini.js';
import { setupCursorHover, setupCursorHoverInfo } from '../../.widgetutils/cursorhover.js';
import { SystemMessage, ChatMessage } from "./ai_chatmessage.js";
import { ConfigToggle, ConfigSegmentedSelection, ConfigGap } from '../../.commonwidgets/configwidgets.js';
import { markdownTest } from '../../.miscutils/md2pango.js';
import { MarginRevealer } from '../../.widgethacks/advancedrevealers.js';
import { chatEntry } from '../apiwidgets.js';

const MODEL_NAME = `Gemini`;

// Helper function to get translated strings with Arabic support
const getLocalizedString = (english, arabic) => {
    // Check if the current locale is Arabic
    // This is a simplified approach - you might want to use a more robust i18n system
    const isArabic = GLib.get_language_names().some(lang => lang.startsWith('ar'));
    return isArabic ? arabic : english;
};

export const geminiTabIcon = Icon({
    hpack: 'center',
    icon: `google-gemini-symbolic`,
})

// Initialize the Gemini service and load history
Utils.timeout(500, () => {
    console.log('Initializing Gemini widget and loading history');
    GeminiService.loadHistory();
});

const GeminiInfo = () => {
    const geminiLogo = Icon({
        hpack: 'center',
        className: 'sidebar-chat-welcome-logo',
        icon: `google-gemini-symbolic`,
    });
    return Box({
        vertical: true,
        className: 'spacing-v-15',
        children: [
            geminiLogo,
            Label({
                className: 'txt txt-title-small sidebar-chat-welcome-txt',
                wrap: true,
                justify: Gtk.Justification.CENTER,
                label: `Assistant (Gemini)`,
            }),
            Box({
                className: 'spacing-h-5',
                hpack: 'center',
                children: [
                    Label({
                        className: 'txt-smallie txt-subtext',
                        wrap: true,
                        justify: Gtk.Justification.CENTER,
                        label: getLocalizedString('Powered by Google', 'مدعوم بواسطة جوجل'),
                    }),
                    Button({
                        className: 'txt-subtext txt-norm icon-material',
                        label: 'info',
                        tooltipText: getLocalizedString("Uses gemini-pro.\nNot affiliated, endorsed, or sponsored by Google.\n\nPrivacy: Chat messages aren't linked to your account,\n    but will be read by human reviewers to improve the model.", "يستخدم gemini-pro.\nليس مرتبطًا بجوجل وليس مدعومًا أو معترف به أو مدعومًا به."),
                        setup: setupCursorHoverInfo,
                    }),
                ]
            }),
        ]
    });
}

export const GeminiSettings = () => MarginRevealer({
    transition: 'slide_down',
    revealChild: true,
    extraSetup: (self) => self
        .hook(GeminiService, (self) => Utils.timeout(200, () => {
            self.attribute.hide();
        }), 'newMsg')
        .hook(GeminiService, (self) => Utils.timeout(200, () => {
            self.attribute.show();
        }), 'clear')
    ,
    child: Box({
        vertical: true,
        className: 'sidebar-chat-settings',
        children: [
            ConfigSegmentedSelection({
                hpack: 'center',
                icon: 'casino',
                name: 'Randomness',
                desc: getLocalizedString("Gemini's temperature value.\n  Precise = 0\n  Balanced = 0.5\n  Creative = 1", "قيمة درجة الحرارة لجيميني.\n  دقيق = 0\n  متوازن = 0.5\n  إبداعي = 1"),
                options: [
                    { value: 0.00, name: getLocalizedString('Precise', 'دقيق'), },
                    { value: 0.50, name: getLocalizedString('Balanced', 'متوازن'), },
                    { value: 1.00, name: getLocalizedString('Creative', 'إبداعي'), },
                ],
                initIndex: 2,
                onChange: (value, name) => {
                    GeminiService.temperature = value;
                },
            }),
            ConfigGap({ vertical: true, size: 10 }), // Note: size can only be 5, 10, or 15
            Box({
                vertical: true,
                hpack: 'fill',
                className: 'sidebar-chat-settings-toggles',
                children: [
                    ConfigToggle({
                        icon: 'model_training',
                        name: getLocalizedString('Enhancements', 'تحسينات'),
                        desc: getLocalizedString("Tells Gemini:\n- It's a Linux sidebar assistant\n- Be brief and use bullet points", "يخبر جيميني:\n- إنه عميل جانبي لنظام تشغيل لينكس\n- كون موجزًا واستخدم نقاط"),
                        initValue: GeminiService.assistantPrompt,
                        onChange: (self, newValue) => {
                            GeminiService.assistantPrompt = newValue;
                        },
                    }),
                    ConfigToggle({
                        icon: 'shield',
                        name: getLocalizedString('Safety', 'السلامة'),
                        desc: getLocalizedString("When turned off, tells the API (not the model) \nto not block harmful/explicit content", "عند تعطيله، يخبر الواجهة البرمجية (ليس النموذج) \nلتعطيل المحتوى الضار أو الصريح"),
                        initValue: GeminiService.safe,
                        onChange: (self, newValue) => {
                            GeminiService.safe = newValue;
                        },
                    }),
                    ConfigToggle({
                        icon: 'history',
                        name: getLocalizedString('History', 'التاريخ'),
                        desc: getLocalizedString("Saves chat history\nMessages in previous chats won't show automatically, but they are there", "يحفظ تاريخ الدردشة\nلن تظهر الرسائل التي تم إرسالها في الدردشات السابقة لكنها موجودة"),
                        initValue: GeminiService.useHistory,
                        onChange: (self, newValue) => {
                            GeminiService.useHistory = newValue;
                        },
                    }),
                    Button({
                        className: 'sidebar-chat-settings-button',
                        onClicked: () => {
                            // Show rules in chat
                            const rules = GeminiService.rules;
                            let rulesText = '';
                            if (rules.length > 0) {
                                rulesText = getLocalizedString('### Your Rules:', '### القواعد الخاصة بك:') + '\n';
                                
                                // Group rules by enabled status
                                const enabledRules = rules.filter(rule => rule.enabled);
                                const disabledRules = rules.filter(rule => !rule.enabled);
                                
                                if (enabledRules.length > 0) {
                                    rulesText += '\n' + getLocalizedString('**Active Rules:**', '**القواعد النشطة:**') + '\n';
                                    enabledRules.forEach(rule => {
                                        rulesText += `- **${rule.id}**: ${rule.content} ✓\n`;
                                    });
                                }
                                
                                if (disabledRules.length > 0) {
                                    rulesText += '\n' + getLocalizedString('**Disabled Rules:**', '**القواعد المعطلة:**') + '\n';
                                    disabledRules.forEach(rule => {
                                        rulesText += `- **${rule.id}**: ${rule.content} ✗\n`;
                                    });
                                }
                                
                                rulesText += '\n' + getLocalizedString('### Rule Management:', '### إدارة القواعد:') + '\n';
                                rulesText += getLocalizedString('- `/rule YOUR_RULE_TEXT` - Add a new rule', '- `/rule نص_القاعدة` - إضافة قاعدة جديدة') + '\n';
                                rulesText += getLocalizedString('- `/togglerule rule-1` - Toggle rule on/off', '- `/togglerule rule-1` - تفعيل/تعطيل القاعدة') + '\n';
                                rulesText += getLocalizedString('- `/removerule id rule-1` - Remove a rule by ID', '- `/removerule id rule-1` - حذف قاعدة بواسطة المعرف') + '\n';
                                rulesText += getLocalizedString('- `/removerule text keyword` - Remove rules containing text', '- `/removerule text كلمة` - حذف القواعد التي تحتوي على نص') + '\n';
                                rulesText += getLocalizedString('- `/removerule all` - Remove all rules', '- `/removerule all` - حذف جميع القواعد');
                                
                                rulesText += '\n\n' + getLocalizedString('*Rules are applied immediately to the current conversation.*', '*يتم تطبيق القواعد فورًا على المحادثة الحالية.*');
                            } else {
                                rulesText = getLocalizedString(
                                    '### No Rules Defined\n\nYou can add rules using the `/rule` command.\n\nRules tell the AI how to behave or what to remember.',
                                    '### لا توجد قواعد محددة\n\nيمكنك إضافة قواعد باستخدام الأمر `/rule`.\n\nالقواعد تخبر الذكاء الاصطناعي كيف يتصرف أو ماذا يتذكر.'
                                );
                            }
                            
                            chatContent.add(SystemMessage(
                                `${rulesText}\n\n` + 
                                getLocalizedString(
                                    'Rules are stored in:\n`~/.ags/ai/rules.json` and `~/.ags/ai/rules.txt`\n\nChanges to rule files are automatically detected and applied immediately.',
                                    'يتم تخزين القواعد في:\n`~/.ags/ai/rules.json` و `~/.ags/ai/rules.txt`\n\nيتم اكتشاف التغييرات في ملفات القواعد وتطبيقها فورًا.'
                                ),
                                getLocalizedString('Your Rules', 'القواعد الخاصة بك'),
                                geminiView
                            ));
                        },
                        setup: setupCursorHover,
                        child: Box({
                            children: [
                                Icon({
                                    icon: 'rules',
                                    className: 'sidebar-chat-settings-icon',
                                }),
                                Box({
                                    vertical: true,
                                    children: [
                                        Label({
                                            xalign: 0,
                                            className: 'txt txt-norm sidebar-chat-settings-title',
                                            label: getLocalizedString('Your Rules', 'القواعد الخاصة بك'),
                                        }),
                                        Label({
                                            xalign: 0,
                                            className: 'txt txt-smallie txt-subtext sidebar-chat-settings-desc',
                                            setup: (self) => {
                                                const updateLabel = () => {
                                                    const activeCount = GeminiService.activeRulesCount;
                                                    const totalCount = GeminiService.totalRulesCount;
                                                    
                                                    if (totalCount === 0) {
                                                        self.label = getLocalizedString('No rules defined yet', 'لا توجد قواعد محددة بعد');
                                                    } else if (activeCount === totalCount) {
                                                        self.label = getLocalizedString(`${activeCount} active rules`, `${activeCount} قواعد نشطة`);
                                                    } else {
                                                        self.label = getLocalizedString(
                                                            `${activeCount} active, ${totalCount} total rules`, 
                                                            `${activeCount} نشطة، ${totalCount} إجمالي القواعد`
                                                        );
                                                    }
                                                };
                                                
                                                // Initial update
                                                updateLabel();
                                                
                                                // Update when rules change
                                                self.hook(GeminiService, updateLabel, 'rulesChanged');
                                            },
                                        }),
                                    ],
                                }),
                                Box({ hexpand: true }),
                                Box({
                                    className: 'rules',
                                    css: 'min-width: 24px; min-height: 24px; border-radius: 12px; background-color: rgba(255, 255, 255, 0.1); margin-right: 8px;',
                                    hpack: 'center',
                                    vpack: 'center',
                                    setup: (self) => {
                                        const updateBadge = () => {
                                            const activeCount = GeminiService.activeRulesCount;
                                            self.children = [
                                                Label({
                                                    className: 'txt-smallie',
                                                    label: `${activeCount}`,
                                                })
                                            ];
                                            
                                            // Update badge color based on count
                                            if (activeCount === 0) {
                                                self.css = 'min-width: 24px; min-height: 24px; border-radius: 12px; background-color: rgba(255, 255, 255, 0.1); margin-right: 8px;';
                                            } else {
                                                self.css = 'min-width: 24px; min-height: 24px; border-radius: 12px; background-color: #f28b82; margin-right: 8px;';
                                            }
                                        };
                                        
                                        // Initial update
                                        updateBadge();
                                        
                                        // Update when rules change
                                        self.hook(GeminiService, updateBadge, 'rulesChanged');
                                    },
                                }),
                            ],
                        }),
                    }),
                ]
            })
        ]
    })
});

export const GoogleAiInstructions = () => Box({
    homogeneous: true,
    children: [Revealer({
        transition: 'slide_down',
        transitionDuration: userOptions.asyncGet().animations.durationLarge,
        setup: (self) => self
            .hook(GeminiService, (self, hasKey) => {
                self.revealChild = (GeminiService.key.length == 0);
            }, 'hasKey')
        ,
        child: Button({
            child: Label({
                useMarkup: true,
                wrap: true,
                className: 'txt sidebar-chat-welcome-txt',
                justify: Gtk.Justification.CENTER,
                wrapMode: Pango.WrapMode.WORD_CHAR,
                label: 'A Google AI API key is required\nYou can grab one <u>here</u>, then enter it below',
                // setup: self => self.set_markup("This is a <a href=\"https://www.github.com\">test link</a>")
            }),
            setup: setupCursorHover,
            onClicked: () => {
                Utils.execAsync(['bash', '-c', `xdg-open https://makersuite.google.com/app/apikey &`]);
            }
        })
    })]
});

const geminiWelcome = Box({
    vexpand: true,
    homogeneous: true,
    child: Box({
        className: 'spacing-v-15',
        vpack: 'center',
        vertical: true,
        children: [
            GeminiInfo(),
            GoogleAiInstructions(),
            GeminiSettings(),
        ]
    })
});

export const chatContent = Box({
    className: 'spacing-v-5',
    vertical: true,
    setup: (self) => self
        .hook(GeminiService, (box, id) => {
            const message = GeminiService.messages[id];
            if (!message) return;
            box.add(ChatMessage(message, MODEL_NAME))
        }, 'newMsg')
        .hook(GeminiService, (box) => {
            // Clear existing messages when history changes
            console.log('History changed, clearing UI messages');
            const children = box.get_children();
            for (let i = 0; i < children.length; i++) {
                children[i].destroy();
            }
            
            // No need to manually add messages here as the newMsg signals will be emitted
            // for each message after historyChanged
        }, 'historyChanged')
    ,
});

const clearChat = () => {
    GeminiService.clear();
    const children = chatContent.get_children();
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        child.destroy();
    }
}

const CommandButton = (command) => Button({
    className: 'sidebar-chat-chip sidebar-chat-chip-action txt txt-small',
    onClicked: () => sendMessage(command),
    setup: setupCursorHover,
    label: command,
});

export const geminiCommands = Box({
    className: 'spacing-h-5',
    children: [
        Box({ hexpand: true }),
        CommandButton('/key'),
        CommandButton('/rule'),
        CommandButton('/removerule'),
        CommandButton('/togglerule'),
        CommandButton('/model'),
        CommandButton('/clear'),
    ]
});

export const sendMessage = (text) => {
    // Check if text or API key is empty
    if (text.length == 0) return;
    if (GeminiService.key.length == 0) {
        GeminiService.key = text;
        chatContent.add(SystemMessage(`Key saved to\n\`${GeminiService.keyPath}\``, 'API Key', geminiView));
        text = '';
        return;
    }
    // Commands
    if (text.startsWith('/')) {
        if (text.startsWith('/clear')) clearChat();
        else if (text.startsWith('/load')) {
            clearChat();
            GeminiService.loadHistory();
        }
        else if (text.startsWith('/model')) chatContent.add(SystemMessage(`${getLocalizedString("Currently using", "حاليًا يستخدم")} \`${GeminiService.modelName}\``, '/model', geminiView))
        else if (text.startsWith('/prompt')) {
            const firstSpaceIndex = text.indexOf(' ');
            const prompt = text.slice(firstSpaceIndex + 1);
            if (firstSpaceIndex == -1 || prompt.length < 1) {
                chatContent.add(SystemMessage(`Usage: \`/prompt MESSAGE\``, '/prompt', geminiView))
            }
            else {
                GeminiService.addMessage('user', prompt)
            }
        }
        else if (text.startsWith('/key')) {
            const parts = text.split(' ');
            if (parts.length == 1) chatContent.add(SystemMessage(
                `${getLocalizedString("Key stored in:", "يتم تخزين المفتاح في:")} \n\`${GeminiService.keyPath}\`\n${getLocalizedString("To update this key, type", "لتحديث هذا المفتاح، اكتب")} \`/key YOUR_API_KEY\``,
                '/key',
                geminiView));
            else {
                GeminiService.key = parts[1];
                chatContent.add(SystemMessage(`${getLocalizedString("Updated API Key at", "تم تحديث مفتاح الواجهة البرمجية عند")}\n\`${GeminiService.keyPath}\``, '/key', geminiView));
            }
        }
        else if (text.startsWith('/togglerule')) {
            const parts = text.split(' ');
            if (parts.length == 1) {
                // Show usage and current rules
                const rules = GeminiService.rules;
                let rulesText = '';
                if (rules.length > 0) {
                    rulesText = getLocalizedString('### Current Rules:', '### القواعد الحالية:') + '\n';
                    rules.forEach(rule => {
                        rulesText += `- **${rule.id}**: ${rule.content} ${rule.enabled ? '✓' : '✗'}\n`;
                    });
                    rulesText += '\n' + getLocalizedString('### Usage:', '### استخدام:') + '\n';
                    rulesText += '- `/togglerule rule-1` - Toggle rule with ID rule-1';
                } else {
                    rulesText = getLocalizedString('No rules defined yet.', 'لا توجد قواعد محددة بعد.');
                }
                chatContent.add(SystemMessage(rulesText, '/togglerule', geminiView));
            } else {
                // Toggle the rule
                const ruleId = parts[1];
                const result = GeminiService.toggleRuleEnabled(ruleId);
                if (result) {
                    chatContent.add(SystemMessage(
                        getLocalizedString(
                            `Rule **${result.id}** is now ${result.enabled ? 'enabled ✓' : 'disabled ✗'}\n\nChanges will apply immediately and to new conversations.`,
                            `قاعدة **${result.id}** الآن ${result.enabled ? 'مفعلة ✓' : 'غير مفعلة ✗'}\n\nسيتم تطبيق التغييرات فورًا وعلى المحادثات الجديدة.`
                        ),
                        '/togglerule',
                        geminiView
                    ));
                } else {
                    chatContent.add(SystemMessage(
                        getLocalizedString(
                            `No rule found with ID \`${ruleId}\`.`,
                            `لم يتم العثور على قاعدة بمعرف \`${ruleId}\`.`
                        ),
                        '/togglerule',
                        geminiView
                    ));
                }
            }
        }
        else if (text.startsWith('/rule')) {
            const firstSpaceIndex = text.indexOf(' ');
            const ruleContent = text.slice(firstSpaceIndex + 1);
            if (firstSpaceIndex == -1 || ruleContent.length < 1) {
                // Show usage and current rules
                const rules = GeminiService.rules;
                let rulesText = '';
                if (rules.length > 0) {
                    rulesText = getLocalizedString('### Current Rules:', '### القواعد الحالية:') + '\n';
                    rules.forEach(rule => {
                        rulesText += `- **${rule.id}**: ${rule.content} ${rule.enabled ? '✓' : '✗'}\n`;
                    });
                    rulesText += '\n' + getLocalizedString('### Usage:', '### استخدام:') + '\n';
                    rulesText += '- `/rule YOUR_RULE_TEXT` - Add a new rule\n';
                    rulesText += '- `/togglerule rule-1` - Toggle rule on/off\n';
                    rulesText += '- `/removerule id rule-1` - Remove a rule';
                } else {
                    rulesText = getLocalizedString('No rules defined yet.', 'لا توجد قواعد محددة بعد.');
                }
                chatContent.add(SystemMessage(
                    getLocalizedString(`Usage: \`/rule YOUR_RULE_TEXT\`\n\n${rulesText}\n\nRules are stored in:\n\`~/.ags/ai/rules.json\` and \`~/.ags/ai/rules.txt\`\n\nChanges to rule files are automatically detected and applied.`, 'استخدام: \`/rule نص_القاعدة\`\n\n${rulesText}\n\nيتم تخزين القواعد في:\n\`~/.ags/ai/rules.json\` و \`~/.ags/ai/rules.txt\`\n\nيتم اكتشاف التغييرات في ملفات القواعد وتطبيقها تلقائيًا.'),
                    '/rule',
                    geminiView
                ));
            } else {
                // Add the rule
                const ruleId = GeminiService.addRule(ruleContent);
                chatContent.add(SystemMessage(
                    getLocalizedString(`Added rule: \`${ruleContent}\`\nID: \`${ruleId}\`\n\nThis rule will be applied immediately and to new conversations.\nUse \`/togglerule ${ruleId}\` to disable/enable it.`, 'تم إضافة قاعدة: \`${ruleContent}\`\nمعرف: \`${ruleId}\`\n\nسيتم تطبيق هذه القاعدة فورًا وعلى المحادثات الجديدة.\nاستخدم \`/togglerule ${ruleId}\` لتعطيل/تفعيله.'),
                    '/rule',
                    geminiView
                ));
            }
        }
        else if (text.startsWith('/removerule')) {
            const parts = text.split(' ');
            if (parts.length == 1) {
                // Show usage and current rules for removal
                const rules = GeminiService.rules;
                let rulesText = '';
                if (rules.length > 0) {
                    rulesText = getLocalizedString('### Current Rules:', '### القواعد الحالية:') + '\n';
                    rules.forEach(rule => {
                        rulesText += `- **${rule.id}**: ${rule.content}\n`;
                    });
                    rulesText += '\n' + getLocalizedString('### Usage:', '### استخدام:') + '\n';
                    rulesText += '- `/removerule id rule-1` - Remove rule with ID rule-1\n';
                    rulesText += '- `/removerule text keyword` - Remove rules containing "keyword"\n';
                    rulesText += '- `/removerule all` - Remove all rules';
                } else {
                    rulesText = getLocalizedString('No rules defined yet.', 'لا توجد قواعد محددة بعد.');
                }
                chatContent.add(SystemMessage(rulesText, '/removerule', geminiView));
            } else if (parts[1] === 'all') {
                // Remove all rules
                const success = GeminiService.removeAllRules();
                if (success) {
                    chatContent.add(SystemMessage(getLocalizedString('All rules have been removed.', 'تم إزالة جميع القواعد.'), '/removerule', geminiView));
                } else {
                    chatContent.add(SystemMessage(getLocalizedString('No rules to remove.', 'لا توجد قواعد لإزالة.'), '/removerule', geminiView));
                }
            } else if (parts[1] === 'id' && parts.length > 2) {
                // Remove rule by ID
                const ruleId = parts[2];
                const success = GeminiService.removeRuleById(ruleId);
                if (success) {
                    chatContent.add(SystemMessage(
                        getLocalizedString(
                            `Rule with ID \`${ruleId}\` has been removed.`,
                            `تم إزالة القاعدة بمعرف \`${ruleId}\`.`
                        ),
                        '/removerule',
                        geminiView
                    ));
                } else {
                    chatContent.add(SystemMessage(
                        getLocalizedString(
                            `No rule found with ID \`${ruleId}\`.`,
                            `لم يتم العثور على قاعدة بمعرف \`${ruleId}\`.`
                        ),
                        '/removerule',
                        geminiView
                    ));
                }
            } else if (parts[1] === 'text' && parts.length > 2) {
                // Remove rule by text content
                const searchText = parts.slice(2).join(' ');
                const success = GeminiService.removeRuleByText(searchText);
                if (success) {
                    chatContent.add(SystemMessage(
                        getLocalizedString(
                            `Rules containing \`${searchText}\` have been removed.`,
                            `تم إزالة القواعد التي تحتوي على \`${searchText}\`.`
                        ),
                        '/removerule',
                        geminiView
                    ));
                } else {
                    chatContent.add(SystemMessage(
                        getLocalizedString(
                            `No rules found containing \`${searchText}\`.`,
                            `لم يتم العثور على قواعد تحتوي على \`${searchText}\`.`
                        ),
                        '/removerule',
                        geminiView
                    ));
                }
            } else {
                // Invalid usage
                chatContent.add(SystemMessage(
                    getLocalizedString('Invalid usage. Try:\n- `/removerule id rule-1`\n- `/removerule text keyword`\n- `/removerule all`', 'استخدام غير صالح. جرب:\n- `/removerule id rule-1`\n- `/removerule text keyword`\n- `/removerule all`'),
                    '/removerule',
                    geminiView
                ));
            }
        }
        else if (text.startsWith('/test'))
            chatContent.add(SystemMessage(markdownTest, getLocalizedString('Markdown test', 'اختبار Markdown'), geminiView));
        else
            chatContent.add(SystemMessage(getLocalizedString('Invalid command.', 'أمر غير صالح.'), 'Error', geminiView))
    }
    else {
        GeminiService.send(text);
    }
}

export const geminiView = Box({
    homogeneous: true,
    vertical: true,
    attribute: {
        'pinnedDown': true
    },
    setup: (self) => self
        .hook(GeminiService, () => {
            // Show notification when rules are reloaded
            chatContent.add(SystemMessage(
                getLocalizedString('Rules have been updated from file changes.\nChanges will apply to the current and new conversations.', 'تم تحديث القواعد من تغيير ملفات\nسيؤثر التغيير على المحادثة الحالية والمحادثات الجديدة.'),
                getLocalizedString('Rules Reloaded', 'تم تحديث القواعد'),
                geminiView
            ));
        }, 'rulesChanged')
        .hook(GeminiService, () => {
            // Show notification when history is reloaded
            chatContent.add(SystemMessage(
                getLocalizedString('Chat history has been updated from file changes.', 'تم تحديث سجل المحادثة من تغييرات الملفات.'),
                getLocalizedString('History Reloaded', 'تم تحديث السجل'),
                geminiView
            ));
        }, 'historyChanged'),
    children: [
        Scrollable({
            className: 'sidebar-chat-viewport',
            vexpand: true,
            child: Box({
                vertical: true,
                children: [
                    geminiWelcome,
                    chatContent,
                ]
            }),
            setup: (scrolledWindow) => {
                // Show scrollbar
                scrolledWindow.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
                const vScrollbar = scrolledWindow.get_vscrollbar();
                vScrollbar.get_style_context().add_class('sidebar-scrollbar');
                // Avoid click-to-scroll-widget-to-view behavior
                Utils.timeout(1, () => {
                    const viewport = scrolledWindow.child;
                    viewport.set_focus_vadjustment(new Gtk.Adjustment(undefined));
                })
                // Always scroll to bottom with new content
                const adjustment = scrolledWindow.get_vadjustment();

                adjustment.connect("changed", () => {
                    if (!geminiView.attribute.pinnedDown) { return; }
                    adjustment.set_value(adjustment.get_upper() - adjustment.get_page_size());
                })

                adjustment.connect("value-changed", () => {
                    geminiView.attribute.pinnedDown = adjustment.get_value() == (adjustment.get_upper() - adjustment.get_page_size());
                });
            }
        })
    ]
});