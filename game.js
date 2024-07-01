

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
var KEYCODE_SELECT1 = get_keycode('q');
var KEYCODE_SELECT2 = get_keycode('w');
var KEYCODE_SELECT3 = get_keycode('e');


function rgba(r, g, b, a) {
    var uint8 = new Uint8ClampedArray([r, g, b, a]);
    var uint32 = new Uint32Array(uint8.buffer);
    return uint32[0];
}


function rgb(r, g, b) {
    return rgba(r, g, b, 255);
}


var NOTHING = 0;
var SAND = rgb(170, 130, 70);
var STONE = rgb(120, 120, 120);
var WATER = rgb(20, 80, 255);


function is_solid(pixel) {
    return pixel === SAND || pixel === STONE;
}


class SandGame {
    constructor(width, height, zoom, canvas) {
        this.width = width;
        this.height = height;
        this.zoom = zoom;
        this.canvas = canvas;

        this.pixels = new Uint32Array(width * height);
        this.pixels_next = new Uint32Array(width * height);
        this.pixels.fill(NOTHING);
        this.pixels_next.fill(NOTHING);

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
    }

    onkeydown(event) {
        if (LOG_KEYS) {
            console.log('keydown', event.keyCode);
        }
        this.keydown[event.keyCode] = true;
        this.dropstuff();
    }
    onkeyup(event) { this.keydown[event.keyCode] = false; }
    onmousedown(event) { this.mousedown = true; this.mousemove(event); }
    onmouseup(event) { this.mousedown = false; }
    onmousemove(event) { this.mousemove(event); }
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
        this.pixels_next[i] = value;
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
        var data = new ImageData(pixel_data, this.width, this.height);
        ctx.putImageData(data, 0, 0);
    }

    step() {
        if (this.mousedown) { this.dropstuff(); }

        // Game physics!
        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                var material = this.get_pixel(x, y);
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
                            this.set_pixel(x, y, material);
                        }
                    } else{
                        // We fall straight down
                        this.move_pixel(x, y, x, y + 1);
                    }
                } else if (is_solid(material)) {
                    // By default, solid materials stay where they are
                    this.set_pixel(x, y, material);
                }
            }
        }

        // Switch pixels and pixels_next
        var pixels_next = this.pixels_next;
        this.pixels_next = this.pixels;
        this.pixels = pixels_next;
        this.pixels_next.fill(NOTHING);

        // Render and continue!
        this.render();
        setTimeout(this.step.bind(this), FRAMERATE);
    }
}


window.addEventListener('load', function() {
    var canvas = document.getElementById('sandgame');
    var game = new SandGame(300, 300, 2, canvas);
    window.game = game;
    game.step();
});
