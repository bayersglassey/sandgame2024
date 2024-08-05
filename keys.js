'use strict';

// Key codes
function get_keycode(s) {
    // e.g.
    // 'a' -> 65
    // 'A' -> 65
    // 'B' -> 66
    // ...etc...
    return s.toUpperCase().charCodeAt(0);
}
var KEYCODE_SHIFT = 16;
var KEYCODE_CONTROL = 17;
var KEYCODE_UP = 38;
var KEYCODE_DOWN = 40;
var KEYCODE_LEFT = 37;
var KEYCODE_RIGHT = 39;
var KEYCODE_SPACE = 32;

var KEYMAP_1 = {
    [KEYCODE_UP]: 'u',
    [KEYCODE_DOWN]: 'd',
    [KEYCODE_LEFT]: 'l',
    [KEYCODE_RIGHT]: 'r',
    [KEYCODE_SPACE]: 'j',
};

var KEY_ROWS = [
    '1234567890',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm',
];

var SELECT = {
    0: NOTHING,
    1: SAND,
    2: WATER,
    3: STONE,
    4: OIL,
    5: WOOD,
    6: SEED,
    7: SPORE,
    8: FIRE1,

    q: SANDSPOUT,
    w: WATERSPOUT,
    e: HOLE,
    r: OILSPOUT,
    t: GLASS,
    y: PLANT,
    u: MUSHROOM,
    i: SMOKE,
    o: STEAM,
};
