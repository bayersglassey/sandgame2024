'use strict';

var FRAMERATE = 30;
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
var KEYCODE_SELECT1 = get_keycode('q');
var KEYCODE_SELECT2 = get_keycode('w');
var KEYCODE_SELECT3 = get_keycode('e');

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
var SKIN = rgb(255, 150, 180);
var CLOTHES = rgb(0, 80, 255);


function is_solid(pixel) {
    return pixel === SAND || pixel === STONE;
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
            if (y < 0 || y >= height) return true;
            var i = y * width + x;
            if (is_solid(pixels[i])) return true;
        }
        return false;
    }

    move_x(dx) {
        // Attmpt to walk 1 pixel left/right, moving up any inclines
        // less high than we are
        var dy0 = 0;
        var dy1 = -(this.height - 1);
        for (var dy = dy0; dy >= dy1; dy--) {
            if (this.collide(dx, dy)) continue;
            this.x += dx;
            this.y += dy;
            break;
        }
    }

    move_y(dy) {
        // Attempt to move 1 pixel up/down
        if (this.collide(0, dy)) return;
        this.y += dy;
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

    onkeydown(event) {
        if (LOG_KEYS) {
            console.log('keydown', event.keyCode);
        }
        this.keydown[event.keyCode] = true;
        this.dropstuff();
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
        this.dropstuff();
    }

    dropstuff() {
        var mx = this.mouse_x, x0 = mx, x1 = mx;
        var my = this.mouse_y, y0 = my, y1 = my;

        if (this.keydown[KEYCODE_SELECT1]) {
            var pixel = STONE;
        } else if (this.keydown[KEYCODE_SELECT2]) {
            var pixel = SAND;
        } else if (this.keydown[KEYCODE_SELECT3]) {
            var pixel = WATER;
        } else if (this.mousedown) {
            // Using the keys doesn't work so well, because then you can't
            // move the cursor with my laptop's touchpad...
            var pixel = this.keydown[KEYCODE_SHIFT]? STONE: SAND;
        } else {
            return;
        }

        if (this.keydown[KEYCODE_CONTROL]) {
            x0 -= 3;
            x1 += 3;
        } else if (pixel === STONE) {
            y1 = this.height - 1;
        }

        for (var x = x0; x <= x1; x++) {
            for (var y = y0; y <= y1; y++) {
                this.set_pixel(x, y, pixel);
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

    move_pixel(x0, y0, x1, y1) {
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

    step() {
        if (this.mousedown) { this.dropstuff(); }

        // Game physics!
        shuffle(this.indexes);
        for (var i of this.indexes) {
            var x = i % this.width;
            var y = Math.floor(i / this.width);
            var material = this.pixels[i];
            if (material === SAND || material == WATER) {
                if (is_solid(this.get_pixel(x, y + 1))) {
                    if (Math.random() < .5 && !is_solid(this.get_pixel(x - 1, y + 1))) {
                        // We fall down and to the left
                        this.move_pixel(x, y, x - 1, y + 1);
                    } else if (!is_solid(this.get_pixel(x + 1, y + 1))) {
                        // We fall down and to the right
                        this.move_pixel(x, y, x + 1, y + 1);
                    } else {
                        // We stay right where we are!
                    }
                } else{
                    // We fall straight down
                    this.move_pixel(x, y, x, y + 1);
                }
            } else if (is_solid(material)) {
                // By default, solid materials stay where they are
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
