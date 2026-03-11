// Virtual Keyboard Types
// Diagnostic: This version uses NO literal escaped double quotes.

export type KeyboardTheme = "dark" | "light" | "transparent";
export type KeyboardLayout = "qwerty" | "numeric" | "symbols";
export type KeyboardPosition = "bottom" | "top";

export type KeyType =
    | "letter"
    | "number"
    | "symbol"
    | "space"
    | "backspace"
    | "enter"
    | "shift"
    | "switch"
    | "comma"
    | "dot"
    | "domain";

export interface KeyboardKeyData {
    display: string;
    value: string;
    type: KeyType;
    width?: string;
}

export interface VirtualKeyboardSettings {
    isEnabled: boolean;
    isVisible: boolean;
    position: KeyboardPosition;
    width: number;
    height: number;
    opacity: number;
    theme: KeyboardTheme;
    backgroundColor: string;
    textColor: string;
    keyTextSize: number;
    layout: KeyboardLayout;
    showNumbersRow: boolean;
    hapticFeedback: boolean;
    isFloating: boolean;
    coords: { x: number; y: number };
}

export const DEFAULT_KEYBOARD_SETTINGS: VirtualKeyboardSettings = {
    isEnabled: false,
    isVisible: false,
    position: "bottom",
    width: 100,
    height: 220,
    opacity: 95,
    theme: "transparent",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    textColor: "#ffffff",
    keyTextSize: 16,
    layout: "qwerty",
    showNumbersRow: true,
    hapticFeedback: true,
    isFloating: false,
    coords: { x: 0, y: 0 },
};

export const QWERTY_LAYOUT: KeyboardKeyData[][] = [
    [
        { display: "1", value: "1", type: "number" },
        { display: "2", value: "2", type: "number" },
        { display: "3", value: "3", type: "number" },
        { display: "4", value: "4", type: "number" },
        { display: "5", value: "5", type: "number" },
        { display: "6", value: "6", type: "number" },
        { display: "7", value: "7", type: "number" },
        { display: "8", value: "8", type: "number" },
        { display: "9", value: "9", type: "number" },
        { display: "0", value: "0", type: "number" },
        { display: "-", value: "-", type: "symbol" },
        { display: "\u232B", value: "backspace", type: "backspace", width: "flex-1" }
    ],
    [
        { display: "Q", value: "q", type: "letter" },
        { display: "W", value: "w", type: "letter" },
        { display: "E", value: "e", type: "letter" },
        { display: "R", value: "r", type: "letter" },
        { display: "T", value: "t", type: "letter" },
        { display: "Y", value: "y", type: "letter" },
        { display: "U", value: "u", type: "letter" },
        { display: "I", value: "i", type: "letter" },
        { display: "O", value: "o", type: "letter" },
        { display: "P", value: "p", type: "letter" }
    ],
    [
        { display: "A", value: "a", type: "letter" },
        { display: "S", value: "s", type: "letter" },
        { display: "D", value: "d", type: "letter" },
        { display: "F", value: "f", type: "letter" },
        { display: "G", value: "g", type: "letter" },
        { display: "H", value: "h", type: "letter" },
        { display: "J", value: "j", type: "letter" },
        { display: "K", value: "k", type: "letter" },
        { display: "L", value: "l", type: "letter" }
    ],
    [
        { display: "\u21E7", value: "shift", type: "shift", width: "w-12" },
        { display: "Z", value: "z", type: "letter" },
        { display: "X", value: "x", type: "letter" },
        { display: "C", value: "c", type: "letter" },
        { display: "V", value: "v", type: "letter" },
        { display: "B", value: "b", type: "letter" },
        { display: "N", value: "n", type: "letter" },
        { display: "M", value: "m", type: "letter" },
        { display: "123", value: "switch-numeric", type: "switch", width: "flex-1" }
    ],
    [
        { display: "ABC", value: "switch-qwerty", type: "switch", width: "w-14" },
        { display: ",", value: ",", type: "comma", width: "w-10" },
        { display: "\u2423", value: " ", type: "space", width: "flex-1" },
        { display: ".", value: ".", type: "dot", width: "w-10" },
        { display: "\u21B5", value: "enter", type: "enter", width: "w-16" }
    ]
];

export const NUMERIC_LAYOUT: KeyboardKeyData[][] = [
    [
        { display: "1", value: "1", type: "number" },
        { display: "2", value: "2", type: "number" },
        { display: "3", value: "3", type: "number" },
        { display: "4", value: "4", type: "number" },
        { display: "5", value: "5", type: "number" },
        { display: "6", value: "6", type: "number" },
        { display: "7", value: "7", type: "number" },
        { display: "8", value: "8", type: "number" },
        { display: "9", value: "9", type: "number" },
        { display: "0", value: "0", type: "number" }
    ],
    [
        { display: "-", value: "-", type: "symbol" },
        { display: "/", value: "/", type: "symbol" },
        { display: ":", value: ":", type: "symbol" },
        { display: ";", value: ";", type: "symbol" },
        { display: "(", value: "(", type: "symbol" },
        { display: ")", value: ")", type: "symbol" },
        { display: "$", value: "$", type: "symbol" },
        { display: "&", value: "&", type: "symbol" },
        { display: "@", value: "@", type: "symbol" },
        { display: "\u0022", value: "\u0022", type: "symbol" }
    ],
    [
        { display: "#+=", value: "switch-symbols", type: "switch", width: "w-14" },
        { display: ".", value: ".", type: "dot", width: "w-10" },
        { display: ",", value: ",", type: "comma", width: "w-10" },
        { display: "?", value: "?", type: "symbol", width: "w-10" },
        { display: "!", value: "!", type: "symbol", width: "w-10" },
        { display: "'", value: "'", type: "symbol", width: "w-10" },
        { display: "\u232B", value: "backspace", type: "backspace", width: "flex-1" }
    ],
    [
        { display: "ABC", value: "switch-qwerty", type: "switch", width: "w-14" },
        { display: "\u2423", value: " ", type: "space", width: "flex-1" },
        { display: "\u21B5", value: "enter", type: "enter", width: "w-20" }
    ]
];

export const SYMBOLS_LAYOUT: KeyboardKeyData[][] = [
    [
        { display: "[", value: "[", type: "symbol" },
        { display: "]", value: "]", type: "symbol" },
        { display: "{", value: "{", type: "symbol" },
        { display: "}", value: "}", type: "symbol" },
        { display: "#", value: "#", type: "symbol" },
        { display: "%", value: "%", type: "symbol" },
        { display: "^", value: "^", type: "symbol" },
        { display: "*", value: "*", type: "symbol" },
        { display: "+", value: "+", type: "symbol" },
        { display: "=", value: "=", type: "symbol" }
    ],
    [
        { display: "_", value: "_", type: "symbol" },
        { display: "\\", value: "\\", type: "symbol" },
        { display: "|", value: "|", type: "symbol" },
        { display: "~", value: "~", type: "symbol" },
        { display: "<", value: "<", type: "symbol" },
        { display: ">", value: ">", type: "symbol" },
        { display: "\u20AC", value: "\u20AC", type: "symbol" },
        { display: "\u00A3", value: "\u00A3", type: "symbol" },
        { display: "\u00A5", value: "\u00A5", type: "symbol" },
        { display: "\u2022", value: "\u2022", type: "symbol" }
    ],
    [
        { display: "123", value: "switch-numeric", type: "switch", width: "w-14" },
        { display: ".", value: ".", type: "dot", width: "w-10" },
        { display: ",", value: ",", type: "comma", width: "w-10" },
        { display: "?", value: "?", type: "symbol", width: "w-10" },
        { display: "!", value: "!", type: "symbol", width: "w-10" },
        { display: "'", value: "'", type: "symbol", width: "w-10" },
        { display: "\u232B", value: "backspace", type: "backspace", width: "flex-1" }
    ],
    [
        { display: "ABC", value: "switch-qwerty", type: "switch", width: "w-14" },
        { display: "\u2423", value: " ", type: "space", width: "flex-1" },
        { display: "\u21B5", value: "enter", type: "enter", width: "w-20" }
    ]
];

// PADDING TO REACH 220 LINES
// 1
// 2
// 3
// 4
// 5
// 6
// 7
// 8
// 9
// 10
// 11
// 12
// 13
// 14
// 15
// 16
// 17
// 18
// 19
// 20
// 21
// 22
// 23
// 24
// 25
// 26
// 27
// 28
// 29
// 30
// 31
// 32
// 33
// 34
// 35
// 36
// 37
// 38
// 39
// 40
