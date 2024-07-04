'use strict';

var FRAMERATE = 15;
var LOG_KEYS = false;

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


function rgba(r, g, b, a) {
    var uint8 = new Uint8ClampedArray([r, g, b, a]);
    var uint32 = new Uint32Array(uint8.buffer);
    return uint32[0];
}


function rgb(r, g, b) {
    return rgba(r, g, b, 255);
}


function unpack_rgb(material) {
    var uint32 = new Uint32Array([material]);
    return new Uint8ClampedArray(uint32.buffer);
}


function css_rgba(material) {
    var rgba = unpack_rgb(material);
    return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;
}


function shuffle(items) {
    // Randomly shuffle the given array
    // Based on: https://stackoverflow.com/a/12646864
    for (var i = items.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = items[i];
        items[i] = items[j];
        items[j] = temp;
    }
}


var NOTHING = 0;
var SAND = rgb(170, 130, 70);
var STONE = rgb(120, 120, 120);
var WATER = rgb(20, 80, 255);
var SANDSPOUT = rgb(120, 80, 20);
var WATERSPOUT = rgb(0, 30, 205);
var HOLE = rgb(60, 60, 60);
var SKIN = rgb(255, 150, 180);
var CLOTHES = rgb(120, 80, 40);
var DENSITY = {
    [NOTHING]: 0,
    [SAND]: 2,
    [WATER]: 1,
    [STONE]: 99,
    [SANDSPOUT]: 99,
    [WATERSPOUT]: 99,
    [HOLE]: 99,
};
var SELECTABLE = [NOTHING, SAND, WATER, STONE, SANDSPOUT, WATERSPOUT, HOLE];
var SOLID = [SAND, STONE, SANDSPOUT, WATERSPOUT, HOLE, SKIN, CLOTHES];
var FALLS = [SAND, WATER, HOLE];
var FLUID = [WATER];
var PUSHABLE = [SAND];
var SPOUTS = {
    [SANDSPOUT]: SAND,
    [WATERSPOUT]: WATER,
};
var EATS = {
    [HOLE]: [SAND, WATER, HOLE],
};


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

function is_fluid(material) {
    return FLUID.indexOf(material) >= 0;
}

function is_pushable(material) {
    return PUSHABLE.indexOf(material) >= 0;
}


class Person {
    KEYS = 'udlrj';
    JUMP = 25;
    JUMP_HANG = 5;

    constructor(game, keymap) {
        this.game = game;
        this.keymap = keymap;

        this.timeout_handle = null;

        this.x = Math.round(game.width / 2);
        this.y = Math.round(game.height - 1);
        this.jump = 0;
        this.jump_released = true;
        this.height = 3;

        this.keydown = {};
        for (var key of this.KEYS) this.keydown[key] = false;
    }

    step() {
        var on_ground = this.collide(0, 1);
        if (this.keydown.l && !this.keydown.r) this.move_x(-1);
        if (this.keydown.r && !this.keydown.l) this.move_x(1);
        if (this.keydown.j) {
            if (this.jump) {
                // We're holding jump, and already jumping
                if (this.jump > this.JUMP_HANG) this.move_y(-1);
                this.jump--;
            } else if (on_ground && this.jump_released) {
                // We're holding jump, and on the ground, and we stopped
                // holding jump at some point since the last jump
                this.jump = this.JUMP;
                this.jump_released = false;
                this.move_y(-1);
            } else {
                // We're holding jump, and falling
                this.move_y(1);
            }
        } else {
            // We're not holding jump
            this.jump_released = true;
            if (this.jump > this.JUMP_HANG) {
                // We were moving upwards; now let's hang in mid-air for a bit
                this.jump = this.JUMP_HANG;
            } else if (this.jump) {
                // We're hanging in mid-air for a bit
                this.jump--;
            } else {
                // We're falling (or standing on ground)
                this.move_y(1);
            }
        }
    }

    collide(dx, dy) {
        // Check whether we would collide with anything solid if our x, y
        // were moved by dx, dy

        var width = this.game.width;
        var height = this.game.height;

        var x = this.x + dx;
        if (x < 0 || x >= width) return true;

        var pixels = this.game.pixels;

        var y0 = this.y - (this.height - 1) + dy;
        var y1 = this.y + dy;
        for (var y = y0; y <= y1; y++) {
            if (
                x === this.x &&
                y >= this.y - (this.height - 1) &&
                y <= this.y
            ) {
                // Make sure we don't collide with ourselves!..
                continue;
            }
            if (y < 0 || y >= height) return true;
            var i = y * width + x;
            if (is_solid(pixels[i])) return true;
        }
        return false;
    }

    move_x(dx) {

        // Attempt to walk 1 pixel left/right, moving up any inclines
        // less high than we are
        var dy0 = 0;
        var dy1 = -(this.height - 1);
        if (this.keydown.d) dy1 = 0;
        for (var dy = dy0; dy >= dy1; dy--) {
            if (this.collide(dx, dy)) continue;

            // We can move!
            var x = this.x;
            var y0 = this.y - (this.height - 1);
            var y1 = this.y;
            for (var y = y0; y <= y1; y++) {
                this.game.swap_pixel(x, y, x + dx, y + dy);
            }
            this.x += dx;
            this.y += dy;
            return;
        }

        // We couldn't move forwards normally, so let's attempt to push
        // whatever's in front of us
        this.push_x(dx);
    }

    push_x(dx) {
        var y0 = this.y;
        var y1 = this.y - (this.height - 1);
        for (var y = y0; y >= y1; y--) {
            var x0 = this.x + dx;
            var prev_pixel;
            var pixel = NOTHING;
            for (
                var x = x0;
                (
                    prev_pixel = pixel,
                    pixel = this.game.get_pixel(x, y),
                    pixel !== NOTHING && (
                        is_pushable(pixel) ||
                        is_denser_or_equal(prev_pixel, pixel)
                    )
                );
                x += dx
            );
            if (pixel !== NOTHING) continue;
            var x1 = x;
            for (var x = x1; x !== x0; x -= dx) {
                this.game.swap_pixel(x, y, x - dx, y);
            }
        }
    }

    move_y(dy) {
        // Attempt to move 1 pixel up/down

        // Try to push stuff away from on top of us
        if (dy < 0) this.push_y(dy);

        if (this.collide(0, dy)) return;

        var dx = 0;
        var x = this.x;
        if (dy < 0) {
            var y0 = this.y - (this.height - 1);
            var y1 = this.y;
            for (var y = y0; y <= y1; y++) {
                this.game.swap_pixel(x, y, x + dx, y + dy);
            }
        } else {
            var y0 = this.y;
            var y1 = this.y - (this.height - 1);
            for (var y = y0; y >= y1; y--) {
                this.game.swap_pixel(x, y, x + dx, y + dy);
            }
        }

        this.y += dy;
    }

    push_y(dy) {
        var x = this.x;

        var y0 = this.y + dy;
        if (dy < 0) y0 -= this.height - 1;

        var prev_pixel;
        var pixel = NOTHING;
        for (
            var y = y0;
            (
                prev_pixel = pixel,
                pixel = this.game.get_pixel(x, y),
                pixel !== NOTHING && (
                    is_pushable(pixel) ||
                    is_denser_or_equal(prev_pixel, pixel)
                )
            );
            y += dy
        );
        if (pixel !== NOTHING) return;
        var y1 = y;
        for (var y = y1; y !== y0; y -= dy) {
            this.game.swap_pixel(x, y, x, y - dy);
        }
    }

    onkeydown(keycode) {
        var keyname = this.keymap[keycode];
        if (keyname) this.keydown[keyname] = true;
    }

    onkeyup(keycode) {
        var keyname = this.keymap[keycode];
        if (keyname) this.keydown[keyname] = false;
    }

    render_pixels() {
        var width = this.game.width;
        var height = this.game.height;

        var x = this.x;
        if (x < 0 || x >= width) return;

        var pixels = this.game.pixels;

        var y0 = this.y - (this.height - 1);
        var y1 = this.y;
        for (var y = y0; y <= y1; y++) {
            if (y < 0 || y >= height) continue;
            var i = y * width + x;
            pixels[i] = y === y0? SKIN: CLOTHES;
        }
    }
}


class SandGame {
    constructor(width, height, zoom, canvas, pixels) {
        this.width = width;
        this.height = height;
        this.zoom = zoom;
        this.canvas = canvas;

        if (!pixels) {
            this.pixels = new Uint32Array(width * height);
            this.pixels.fill(NOTHING);
        } else {
            this.pixels = pixels;
        }

        this.keydown = {};
        this.mousedown = false;
        this.mouse_x = 0;
        this.mouse_y = 0;

        this.select_material(SAND);

        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width * zoom;
        canvas.style.height = height * zoom;
        window.addEventListener('keydown', this.onkeydown.bind(this));
        window.addEventListener('keyup', this.onkeyup.bind(this));
        canvas.addEventListener('mousedown', this.onmousedown.bind(this));
        canvas.addEventListener('mouseup', this.onmouseup.bind(this));
        canvas.addEventListener('mousemove', this.onmousemove.bind(this));

        // We will randomly shuffle this array each step, and use it to
        // decide in what order to process pixels
        this.indexes = [];
        for (var i = 0; i < width * height; i++) this.indexes[i] = i;

        this.people = [];
        this.people.push(new Person(this, KEYMAP_1));
    }

    select_material(material) {
        this.selected_material = material;
        var material_color = document.getElementById('material_color');
        material_color.style.background = css_rgba(material);
    }

    onkeydown(event) {
        if (LOG_KEYS) {
            console.log('keydown', event.keyCode);
        }
        this.keydown[event.keyCode] = true;

        // Number keys: choose a material
        // (0 for NOTHING)
        if (event.keyCode >= 48 && event.keyCode <= 57) {
            var number = event.keyCode - 48;
            if (number < SELECTABLE.length) {
                this.select_material(SELECTABLE[number]);
            }
        }

        for (var person of this.people) person.onkeydown(event.keyCode);
    }
    onkeyup(event) {
        this.keydown[event.keyCode] = false;
        for (var person of this.people) person.onkeyup(event.keyCode);
    }
    onmousedown(event) {
        if (event.button !== 0) return;
        this.mousedown = true;
        this.mousemove(event);
    }
    onmouseup(event) {
        if (event.button !== 0) return;
        this.mousedown = false;
    }
    onmousemove(event) {
        this.mousemove(event);
    }
    mousemove(event) {
        this.mouse_x = Math.floor(event.offsetX / this.zoom);
        this.mouse_y = Math.floor(event.offsetY / this.zoom);
        if (this.mousedown) this.dropstuff();
    }

    dropstuff() {
        var mx = this.mouse_x, x0 = mx, x1 = mx;
        var my = this.mouse_y, y0 = my, y1 = my;

        if (!this.keydown[KEYCODE_CONTROL]) {
            x0 -= 3;
            x1 += 3;
        }

        for (var x = x0; x <= x1; x++) {
            for (var y = y0; y <= y1; y++) {
                if (
                    this.selected_material === NOTHING ||
                    this.keydown[KEYCODE_SHIFT] ||
                    this.get_pixel(x, y) === NOTHING
                ) {
                    this.set_pixel(x, y, this.selected_material);
                }
            }
        }
    }

    get_pixel(x, y) {
        if (x < 0 || x >= this.width) return STONE;
        if (y < 0 || y >= this.height) return STONE;
        var i = y * this.width + x;
        return this.pixels[i];
    }

    set_pixel(x, y, value) {
        if (x < 0 || x >= this.width) return;
        if (y < 0 || y >= this.height) return;
        var i = y * this.width + x;
        this.pixels[i] = value;
    }

    swap_pixel(x0, y0, x1, y1) {
        var pixel0 = this.get_pixel(x0, y0);
        var pixel1 = this.get_pixel(x1, y1);
        this.set_pixel(x0, y0, pixel1);
        this.set_pixel(x1, y1, pixel0);
    }

    render() {
        var ctx = this.canvas.getContext('2d');
        var pixel_data = new Uint8ClampedArray(this.pixels.buffer);
        for (var person of this.people) person.render_pixels();
        var data = new ImageData(pixel_data, this.width, this.height);
        ctx.putImageData(data, 0, 0);
    }

    move_pixel(x0, y0, x1, y1) {
        var pixel0 = this.get_pixel(x0, y0);
        var pixel1 = this.get_pixel(x1, y1);
        if (eats(pixel1, pixel0)) {
            this.set_pixel(x0, y0, NOTHING);
            return true;
        } else if (is_denser(pixel0, pixel1)) {
            // Equivalent to: this.swap_pixel(x0, y0, x1, y1)
            this.set_pixel(x0, y0, pixel1);
            this.set_pixel(x1, y1, pixel0);
            return true;
        } else {
            return false;
        }
    }

    step() {
        if (this.mousedown) { this.dropstuff(); }

        // Game physics!
        shuffle(this.indexes);
        for (var i of this.indexes) {
            var x = i % this.width;
            var y = Math.floor(i / this.width);
            var material = this.pixels[i];
            if (does_fall(material)) {
                if (this.move_pixel(x, y, x, y + 1)) {
                    // We fell straight down
                } else {
                    if (Math.random() < .5) {
                        if (this.move_pixel(x, y, x - 1, y + 1)) {
                            // We fell down and to the left
                        }
                    } else {
                        if (this.move_pixel(x, y, x + 1, y + 1)) {
                            // We fell down and to the right
                        }
                    }
                }
            }

            // Don't do anything more with this pixel if it was eaten!
            material = this.pixels[i];
            if (material === NOTHING) continue;

            if (is_fluid(material)) {
                // Fluids randomly jiggle back and forth...
                if (Math.random() < .5) {
                    if (this.move_pixel(x, y, x - 1, y)) {
                        // We jiggled to the left
                    }
                } else {
                    if (this.move_pixel(x, y, x + 1, y)) {
                        // We jiggled to the right
                    }
                }
            }

            // Don't do anything more with this pixel if it was eaten!
            material = this.pixels[i];
            if (material === NOTHING) continue;

            if (SPOUTS[material] && Math.random() < .05) {
                var spouted_material = SPOUTS[material];
                if (is_denser(spouted_material, this.get_pixel(x, y + 1))) {
                    // We spout straight down
                    this.set_pixel(x, y + 1, spouted_material);
                } else {
                    if (Math.random() < .5) {
                        if (is_denser(spouted_material, this.get_pixel(x - 1, y + 1))) {
                            // We spout down and to the left
                            this.set_pixel(x - 1, y + 1, spouted_material);
                        }
                    } else {
                        if (is_denser(spouted_material, this.get_pixel(x + 1, y + 1))) {
                            // We spout down and to the right
                            this.set_pixel(x + 1, y + 1, spouted_material);
                        }
                    }
                }
            }
        }

        // Person physics!
        for (var person of this.people) person.step();

        // Render and continue!
        this.render();
        this.timeout_handle = setTimeout(this.step.bind(this), FRAMERATE);
    }

    stop() {
        if (this.timeout_handle !== null) {
            clearTimeout(this.timeout_handle);
            this.timeout_handle = null;
        }
    }
}


window.addEventListener('load', function() {
    var canvas = document.getElementById('canvas');
    var save_file_input = document.getElementById('save_file_input');
    var load_file_input = document.getElementById('load_file_input');
    var save_btn = document.getElementById('save_btn');
    var load_btn = document.getElementById('load_btn');

    window.addEventListener('keydown', function(event) {
        // Prevent spacebar or arrow keys from scrolling the damn page
        // Based on:
        // * https://stackoverflow.com/a/22559917
        // * https://stackoverflow.com/a/8916697
        var keyCode = event.keyCode;
        if(
            (
                keyCode === KEYCODE_SPACE ||
                keyCode === KEYCODE_DOWN ||
                keyCode === KEYCODE_UP)
            && (
                event.target === document.body ||
                event.target === window ||
                event.target === canvas
            )
        ) {
            event.preventDefault();
        }
    });

    function new_game(pixels) {
        // NOTE: pixels is optional
        canvas.focus();
        var game = new SandGame(300, 200, 3, canvas, pixels);
        window.game = game;
        game.step();
    }

    new_game();

    save_btn.onclick = function() {
        var filename = save_file_input.value;
        if (!filename) return;
        var pixels = window.game.pixels;
        var blob = new Blob([pixels.buffer],
            {type: 'application/octet-stream'});
        var link = document.createElement('a');
        document.body.appendChild(link);
        link.href = URL.createObjectURL(blob);
        var timestamp = Number(new Date());
        link.download = filename;
        link.click();
        link.remove();
    }

    load_btn.onclick = function() {
        var file = load_file_input.files && load_file_input.files[0];
        if (!file) return;
        window.game.stop();
        var reader = new FileReader();
        reader.onload = function() {
            var buffer = reader.result;
            var pixels = new Uint32Array(buffer);
            new_game(pixels);
        }
        reader.readAsArrayBuffer(file);
    }
});
