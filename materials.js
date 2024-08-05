'use strict';


var NOTHING = 0;
var WIND = rgba(255, 255, 225, 90);
var SAND = rgb(170, 130, 70);
var STONE = rgb(120, 120, 120);
var WATER = rgb(20, 80, 255);
var RAIN = rgba(20, 80, 255, 125);
var OIL = rgb(20, 180, 200);
var SANDSPOUT = rgb(120, 80, 20);
var WATERSPOUT = rgb(0, 30, 205);
var OILSPOUT = rgb(0, 130, 150);
var HOLE = rgb(60, 60, 60);
var SKIN = rgb(255, 150, 180);
var CLOTHES = rgb(120, 80, 40);
var WOOD = rgb(255, 125, 125);
var GLASS = rgba(180, 180, 225, 130);
var SEED = rgb(170, 230, 70);
var PLANT = rgb(70, 200, 70);
var SPORE = rgb(110, 120, 130);
var MUSHROOM = rgb(230, 240, 250);
var FIRE1 = rgba(255, 120, 20, 200);
var FIRE2 = rgba(220, 0, 0, 200);
var SMOKE = rgba(180, 180, 180, 130);
var STEAM = rgba(180, 180, 255, 130);
var TRANSPARENT = [NOTHING, WIND, WATER, RAIN, HOLE, GLASS, SPORE, FIRE1, FIRE2, STEAM];
var DENSITY = {
    [NOTHING]: 0,
    [WIND]: 1,
    [SAND]: 9,
    [WATER]: 8,
    [RAIN]: 2,
    [OIL]: 7,
    [STONE]: 99,
    [SANDSPOUT]: 99,
    [WATERSPOUT]: 99,
    [OILSPOUT]: 99,
    [HOLE]: 9,
    [WOOD]: 9,
    [GLASS]: 99,
    [SEED]: 9,
    [PLANT]: 9,
    [SPORE]: 2,
    [MUSHROOM]: 9,
    [FIRE1]: 3,
    [FIRE2]: 3,
    [SMOKE]: 2,
    [STEAM]: 1,
};
var SOLID = [
    SAND,
    STONE,
    SANDSPOUT,
    WATERSPOUT,
    OILSPOUT,
    HOLE,
    SKIN,
    CLOTHES,
    WOOD,
    GLASS,
    SEED,
    PLANT,
    MUSHROOM,
];
var FALLS = [SAND, WATER, OIL, HOLE, WOOD, SEED, PLANT, MUSHROOM];
var FALLS_UP = [SMOKE, STEAM];
var FALLS_STRAIGHT = [WOOD];
var WAFTS = [SPORE, FIRE1, FIRE2];
var BECOMES = {
    [FIRE1]: {chance: .025, material: FIRE2},
    [FIRE2]: {chance: .01, material: SMOKE},
    [SMOKE]: {chance: .005, material: NOTHING},
    [WATER]: {chance: .0005, only_light: true, material: STEAM},
    [STEAM]: {chance: .005, material: WATER},
};
var SUPPORTS = {
    [WOOD]: [WOOD],
    [PLANT]: [PLANT],
    [MUSHROOM]: [MUSHROOM],
};
var FLUID = [WATER, OIL, SPORE, FIRE1, FIRE2, SMOKE, STEAM];
var PUSHABLE = [SAND, WOOD, SEED, PLANT, MUSHROOM];
var SPOUTS = {
    [SANDSPOUT]: SAND,
    [WATERSPOUT]: WATER,
    [OILSPOUT]: OIL,
};
var TRANSFORMS = {
    [WATER]: {
        [SEED]: {material: PLANT, only_light: true, grow_chance: .98},
        [SPORE]: {material: MUSHROOM, only_dark: true, grow_chance: .85},
        [FIRE1]: {material: STEAM},
        [FIRE2]: {material: STEAM},
    },
    [FIRE1]: {
        [OIL]: {material: FIRE1, remain: true},
        [WOOD]: {material: FIRE1, remain: true},
        [SEED]: {material: FIRE1, remain: true},
        [SPORE]: {material: FIRE1, remain: true},
        [PLANT]: {material: FIRE1, remain: true},
        [MUSHROOM]: {material: FIRE1, remain: true},
    },
    [FIRE2]: {
        [OIL]: {material: FIRE1, remain: true},
        [WOOD]: {material: FIRE1, remain: true},
        [SEED]: {material: FIRE1, remain: true},
        [SPORE]: {material: FIRE1, remain: true},
        [PLANT]: {material: FIRE1, remain: true},
        [MUSHROOM]: {material: FIRE1, remain: true},
    },
};
var EATS = {
    [HOLE]: [SAND, WATER, RAIN, OIL, HOLE, SEED, SPORE, FIRE1, FIRE2, SMOKE, STEAM],
};


function is_transparent(material) {
    return TRANSPARENT.indexOf(material) >= 0;
}

function get_density(material) {
    var density = DENSITY[material];
    if (density === undefined) return 10;
    return density;
}

function eats(material1, material2) {
    var eats_materials = EATS[material1];
    if (!eats_materials) return false;
    return eats_materials.indexOf(material2) >= 0;
}

function is_denser(material1, material2) {
    return get_density(material1) > get_density(material2);
}

function is_denser_or_equal(material1, material2) {
    return get_density(material1) >= get_density(material2);
}

function is_solid(material) {
    return SOLID.indexOf(material) >= 0;
}

function get_fall_dy(material) {
    if (FALLS.indexOf(material) >= 0) return 1;
    else if (FALLS_UP.indexOf(material) >= 0) return -1;
    else return 0;
}

function does_fall_straight(material) {
    return FALLS_STRAIGHT.indexOf(material) >= 0;
}

function does_waft(material) {
    return WAFTS.indexOf(material) >= 0;
}

function supports(material1, material2) {
    var supports_materials = SUPPORTS[material1];
    if (!supports_materials) return false;
    return supports_materials.indexOf(material2) >= 0;
}

function is_fluid(material) {
    return FLUID.indexOf(material) >= 0;
}

function is_pushable(material) {
    return PUSHABLE.indexOf(material) >= 0;
}
