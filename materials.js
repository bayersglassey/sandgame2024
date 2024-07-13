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
var TRANSPARENT = [NOTHING, WIND, WATER, RAIN, HOLE, GLASS];
var DENSITY = {
    [NOTHING]: 0,
    [WIND]: 1,
    [SAND]: 9,
    [WATER]: 8,
    [RAIN]: 1,
    [OIL]: 7,
    [STONE]: 99,
    [SANDSPOUT]: 99,
    [WATERSPOUT]: 99,
    [OILSPOUT]: 99,
    [HOLE]: 9,
    [WOOD]: 9,
    [GLASS]: 99,
};
var SOLID = [SAND, STONE, SANDSPOUT, WATERSPOUT, OILSPOUT, HOLE, SKIN, CLOTHES, WOOD, GLASS];
var FALLS = [SAND, WATER, OIL, HOLE, WOOD];
var FALLS_STRAIGHT = [WOOD];
var SUPPORTS = {
    [WOOD]: [WOOD],
};
var FLUID = [WATER, OIL];
var PUSHABLE = [SAND, WOOD];
var SPOUTS = {
    [SANDSPOUT]: SAND,
    [WATERSPOUT]: WATER,
    [OILSPOUT]: OIL,
};
var EATS = {
    [HOLE]: [SAND, WATER, RAIN, OIL, HOLE],
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

function does_fall(material) {
    return FALLS.indexOf(material) >= 0;
}

function does_fall_straight(material) {
    return FALLS_STRAIGHT.indexOf(material) >= 0;
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
