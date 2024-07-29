'use strict';


var TIME_UNITS_PER_DAY = 6000;
var MIDNIGHT = 0;
var DAWN = TIME_UNITS_PER_DAY * (1 / 4);
var NOON = TIME_UNITS_PER_DAY * (2 / 4);
var SUNSET = TIME_UNITS_PER_DAY * (3 / 4);


var DEFAULT_PORTAL_WIDTH = 16;
var DEFAULT_PORTAL_HEIGHT = 16;


var DEFAULT_GAMEDATA = {
    width: 300,
    height: 200,
    time: 0,
    people: [{}],
    portals: [],
};


function get_portal_color(t) {
    function bounce(t) {
        var c = (t * 4) % 512;
        return (c >= 256)? 512 - c: c;
    }
    return rgb(bounce(t), bounce(t + 100), bounce(t + 200));
}


class Portal {
    SERIALIZE_FIELDS = ['x', 'y', 'width', 'height', 'image_url'];

    constructor(x, y, width, height, image_url) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.image_url = image_url || null;
    }
}


class SandGame {
    SERIALIZE_FIELDS = ['width', 'height', 'zoom',
        'people', 'portals', 'time'];

    constructor(canvas, pixels, gamedata, image_url) {
        gamedata = gamedata || {};

        // Get default values for gamedata fields
        for (var key of this.SERIALIZE_FIELDS) {
            if (key in gamedata) continue;
            gamedata[key] = DEFAULT_GAMEDATA[key];
        }

        var width = gamedata.width;
        var height = gamedata.height;
        var zoom = 4;

        // NOTE: pixels is an optional Uint32Array
        this.canvas = canvas;
        this.width = width;
        this.height = height;
        this.zoom = zoom;
        this.image_url = image_url || null;
        this.time = gamedata.time;
        this.timeout_handle = null;

        this.step_timer = new GameTimer();
        this.render_timer = new GameTimer();

        this.timestamp = get_timestamp();

        if (!pixels) {
            this.pixels = new Uint32Array(width * height);
            this.pixels.fill(NOTHING);
        } else {
            this.pixels = pixels;
        }
        this.render_pixels = new Uint32Array(width * height);

        this.sun = new Uint8Array(width * height);

        this.wind_dx = 1; // can be +/- 1

        this.keydown = {};
        this.mousedown = false;
        this.mouse_x = 0;
        this.mouse_y = 0;

        this.selected_material = null;
        this.adding_portal = false;
        this.moving_person = false;
        this.select_material(SAND);

        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width * zoom;
        canvas.style.height = height * zoom;
        window.addEventListener('keydown', this.onkeydown.bind(this));
        window.addEventListener('keyup', this.onkeyup.bind(this));
        canvas.addEventListener('mousedown', this.onmousedown.bind(this));
        window.addEventListener('mouseup', this.onmouseup.bind(this));
        canvas.addEventListener('mousemove', this.onmousemove.bind(this));

        // We will randomly shuffle this array each step, and use it to
        // decide in what order to process pixels
        this.indexes = [];
        for (var i = 0; i < width * height; i++) this.indexes[i] = i;

        this.people = [];
        for (var person_gamedata of gamedata.people) {
            var keymap = KEYMAP_1; // TODO: add more keymaps, or AI, or whatever
            var person = new Person(this, keymap);
            this.people.push(person);
            deserialize(person, person_gamedata);
        }

        // Array of Weather instances
        this.weathers = [];

        // When we touch a portal, we need to load a new level, but loading
        // is an async operation, so we need a way to make sure we don't
        // trigger another load while waiting for the first one to finish.
        // So, we set this to true, and it causes the game to be paused
        // until the load completes.
        this.portal_activated = false;

        this.portals = [];
        for (var portal_gamedata of gamedata.portals) {
            this.add_portal(
                portal_gamedata.x,
                portal_gamedata.y,
                portal_gamedata.width,
                portal_gamedata.height,
                portal_gamedata.image_url,
            );
        }
    }

    add_portal(x, y, width, height, image_url) {
        // wtf, javascript
        if (x === undefined) throw new Error("x undefined");
        if (y === undefined) throw new Error("y undefined");
        if (width === undefined) throw new Error("width undefined");
        if (height === undefined) throw new Error("height undefined");
        var portal = new Portal(x, y, width, height, image_url);
        this.portals.push(portal);
    }

    select_material(material) {
        this.adding_portal = false;
        this.moving_person = false;
        if (this.selected_material !== null) {
            var elem = get_material_elem(this.selected_material);
            elem.classList.remove('selected');
        }
        if (material !== null) {
            var elem = get_material_elem(material);
            elem.classList.add('selected');
        }
        this.selected_material = material;
    }

    onkeydown(event) {
        if (LOG_KEYS) {
            console.log('keydown', event.keyCode);
        }
        this.keydown[event.keyCode] = true;

        if (EDITOR_MODE) {
            // Key is in 0-9 or a-z
            var key = event.key.toLowerCase()
            if (key in SELECT) {
                this.select_material(SELECT[key]);
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
        this.set_mouse(event);
        if (this.adding_portal) {
            var portal_image_input = document.getElementById('portal_image_input');
            var image_url = portal_image_input.value || null;
            var w = DEFAULT_PORTAL_WIDTH;
            var h = DEFAULT_PORTAL_HEIGHT;
            this.add_portal(
                this.mouse_x - Math.floor(w / 2),
                this.mouse_y - Math.floor(h / 2),
                w, h, image_url);
            this.adding_portal = false;
        } else if (this.moving_person) {
            if (
                this.mouse_x >= 0 && this.mouse_x < this.width &&
                this.mouse_y >= 0 && this.mouse_y < this.height
            ) {
                var person = this.people[0];
                person.clear_pixels();
                person.x = this.mouse_x;
                person.y = this.mouse_y;
                this.moving_person = false;
            }
        } else {
            this.mousedown = true;
            this.dropstuff();
        }
    }
    onmouseup(event) {
        if (event.button !== 0) return;
        this.mousedown = false;
    }
    onmousemove(event) {
        this.set_mouse(event);
        if (this.mousedown) this.dropstuff();
    }
    set_mouse(event) {
        this.mouse_x = Math.floor(event.offsetX / this.zoom);
        this.mouse_y = Math.floor(event.offsetY / this.zoom);
    }

    dropstuff() {
        if (!EDITOR_MODE) return;

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
                    get_density(this.get_pixel(x, y)) === 0
                ) {
                    this.set_pixel(x, y, this.selected_material);
                }
            }
        }

        this.render();
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

    push_x(x0, y0, dx) {
        var y = y0;
        var prev_pixel;
        var pixel = NOTHING;
        for (
            var x = x0;
            (
                prev_pixel = pixel,
                pixel = this.get_pixel(x, y),
                get_density(pixel) > 0 && (
                    is_pushable(pixel) ||
                    is_denser_or_equal(prev_pixel, pixel)
                )
            );
            x += dx
        );
        if (get_density(pixel) > 0) return;
        var x1 = x;
        for (var x = x1; x !== x0; x -= dx) {
            this.swap_pixel(x, y, x - dx, y);
        }
    }

    push_y(x0, y0, dy) {
        var x = x0;
        var prev_pixel;
        var pixel = NOTHING;
        for (
            var y = y0;
            (
                prev_pixel = pixel,
                pixel = this.get_pixel(x, y),
                get_density(pixel) > 0 && (
                    is_pushable(pixel) ||
                    is_denser_or_equal(prev_pixel, pixel)
                )
            );
            y += dy
        );
        if (get_density(pixel) > 0) return;
        var y1 = y;
        for (var y = y1; y !== y0; y -= dy) {
            this.swap_pixel(x, y, x, y - dy);
        }
    }

    pull_x(x0, y0, dx) {
        var x = x0;
        var y = y0;
        var pixel, pulled_pixel;
        while(
            pixel = this.get_pixel(x, y),
            pulled_pixel = this.get_pixel(x - dx, y),
            is_pushable(pulled_pixel) && is_denser_or_equal(pulled_pixel, pixel)
        ) {
            this.swap_pixel(x - dx, y, x, y);
            x -= dx;
        }
    }

    render() {
        var timer = this.render_timer;
        timer.start();

        // Render people to this.pixels
        for (var person of this.people) person.render_pixels();
        timer.mark('render_people');

        // Copy the data from this.pixels, so we can draw more stuff
        // without affecting our particular simulation
        this.render_pixels.set(this.pixels);
        timer.mark('copy_pixels');

        // Render sunlight!
        this.render_sun();
        timer.mark('render_sun');

        // Render portals!
        var portal_color = get_portal_color(this.time);
        for (var portal of this.portals) {
            draw_rect(this.render_pixels, this.width,
                portal.x, portal.y, portal.width, portal.height,
                portal_color);
        }
        timer.mark('render_portals');

        // Draw pixels onto canvas
        draw_pixels_on_canvas(this.render_pixels, this.canvas);
        timer.mark('draw_canvas');
    }

    render_sun() {

        // TODO: there should be "keyframe" colour values for the different
        // times of day (midnight -> dawn -> noon -> dusk), and we should
        // interpolate between them.
        // (But then we probably need to do linear interpolation, not bitwise
        // OR/AND.)
        // These values should be serialized in the levels.
        // So should the min/max sun slope ("dx" stuff in calculate_sun).
        var sun_mask = rgba(32, 69, 69, 69);
        var shade_mask = rgba(229, 199, 199, 255);
        /*
        var t = (this.time < NOON? this.time: TIME_UNITS_PER_DAY - this.time) / NOON;
        var sun_mask = linear_rgba(
            0, 0, 32, 33,
            32, 69, 69, 69,
            t);
        var shade_mask = linear_rgba(
            99, 0, 99, 255,
            229, 199, 199, 255,
            t);
        */

        var pixels = this.render_pixels;
        var i1 = this.width * this.height - 1;
        for (var i = 0; i <= i1; i++) {
            if (this.sun[i]) pixels[i] |= sun_mask;
            else pixels[i] &= shade_mask;
        }
    }

    move_pixel(x0, y0, x1, y1, move_if_equal) {
        move_if_equal = move_if_equal || false;
        var pixel0 = this.get_pixel(x0, y0);
        var pixel1 = this.get_pixel(x1, y1);

        var transforms = TRANSFORMS[pixel0] && TRANSFORMS[pixel0][pixel1];
        if (transforms) {
            // E.g. pixel0 is WATER and pixel1 is SEED
            var sun = this.sun[y1 * this.width + x1];
            if (
                (!transforms.only_light || sun) &&
                (!transforms.only_dark || !sun)
            ) {
                this.set_pixel(x0, y0, NOTHING);
                this.set_pixel(x1, y1, transforms.material);
                return true;
            }
        }

        if (eats(pixel1, pixel0)) {
            this.set_pixel(x0, y0, NOTHING);
            return true;
        } else if (
            move_if_equal?
            is_denser_or_equal(pixel0, pixel1):
            is_denser(pixel0, pixel1)
        ) {
            // Equivalent to: this.swap_pixel(x0, y0, x1, y1)
            this.set_pixel(x0, y0, pixel1);
            this.set_pixel(x1, y1, pixel0);
            return true;
        } else {
            return false;
        }
    }

    step() {
        if (this.portal_activated) return;

        var timer = this.step_timer;
        timer.start();

        if (this.mousedown) { this.dropstuff(); }
        timer.mark('dropstuff');

        // Tick... tick... tick...
        this.time = (this.time + 1) % TIME_UNITS_PER_DAY;

        for (var j = 0; j < this.weathers.length; j++) {
            var weather = this.weathers[j];
            if (weather.done()) {
                // Delete this weather entry
                this.weathers.splice(j, 1);
                j--;
            } else {
                weather.step(this);
                weather.age++;
            }
        }
        timer.mark('weathers');

        // Game physics!
        shuffle(this.indexes);
        timer.mark('shuffle_indexes');
        for (var i of this.indexes) {
            var x = i % this.width;
            var y = Math.floor(i / this.width);
            var material = this.pixels[i];

            // Wind & rain physics
            if (material === WIND) {
                var dx = this.wind_dx;
                this.push_x(x + dx, y, dx);
                if (!this.move_pixel(x, y, x + dx, y, true)) {
                    // Wind disappears when it hits something it can't push
                    this.pixels[i] = NOTHING;
                }
            } else if (material === RAIN) {
                var dx = this.wind_dx;
                if (!this.move_pixel(x, y, x + dx, y + 1, true)) {
                    // Rain turns into water when it hits something denser
                    // than itself
                    this.pixels[i] = WATER;
                }
            }

            // Don't do anything more with this pixel if it moved!
            if (this.pixels[i] !== material) continue;

            var dy = 0;
            if (does_fall(material)) {
                dy = 1;
            } else if (does_waft(material)) {
                var r = Math.random();
                if (r < .3) dy = 1;
                else if (r < .6) dy = -1;
            }

            // Falling/wafting physics
            if (dy) {
                var supported = (
                    (
                        supports(this.get_pixel(x - 1, y), material) &&
                        supports(this.get_pixel(x + 1, y), material)
                    ) ||
                    supports(this.get_pixel(x - 1, y - dy), material) ||
                    supports(this.get_pixel(x + 1, y - dy), material)
                );
                if (supported) {
                    // Don't fall!
                } else if (this.move_pixel(x, y, x, y + dy)) {
                    // We fell straight up/down
                } else if (!does_fall_straight(material)) {
                    if (Math.random() < .5) {
                        if (this.move_pixel(x, y, x - 1, y + dy)) {
                            // We fell up/down and to the left
                        }
                    } else {
                        if (this.move_pixel(x, y, x + 1, y + dy)) {
                            // We fell up/down and to the right
                        }
                    }
                }
            }

            // Don't do anything more with this pixel if it moved!
            if (this.pixels[i] !== material) continue;

            // Fluid physics
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

            // Don't do anything more with this pixel if it moved!
            if (this.pixels[i] !== material) continue;

            // Spouting physics
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
        timer.mark('particle_physics');

        // Person physics!
        for (var person of this.people) person.step();
        timer.mark('people');

        // Light physics!
        this.calculate_sun();
        timer.mark('sun');

        // Render!
        this.render();
        timer.mark('render');

        // Timing and stuff!
        var new_timestamp = get_timestamp();
        var took = new_timestamp - this.timestamp;
        var delay = Math.max(0, FRAMERATE - took);
        this.timestamp = new_timestamp;
        this.timeout_handle = setTimeout(this.step.bind(this), delay);
        timer.mark('timing');
    }

    calculate_sun() {
        var time_percent = this.time / TIME_UNITS_PER_DAY;
        var dx = 5 - (10 * time_percent);

        this.sun.fill(0);

        var x1 = this.width - 1;
        var y1 = this.height - 1;
        for (var x = 0; x <= x1; x++) {
            var blocked = false;
            var xwrap = 0;
            for (var y = 0; y <= y1; y++) {
                var _x = Math.floor(x + y * dx / 10) + xwrap;
                if (_x < 0) {
                    // Wrap around
                    xwrap += this.width;
                    _x += this.width;
                    blocked = false;
                } else if (_x >= this.width) {
                    // Wrap around
                    xwrap -= this.width;
                    _x -= this.width;
                    blocked = false;
                }
                var i = y * this.width + _x;
                var pixel = this.pixels[i];
                if (!blocked) this.sun[i] = 1;
                if (!is_transparent(pixel)) blocked = true;
            }
        }
    }

    stop() {
        if (this.timeout_handle !== null) {
            clearTimeout(this.timeout_handle);
            this.timeout_handle = null;
        }
    }

    start() {
        if (this.timeout_handle === null) this.step();
    }

    is_running() {
        return this.timeout_handle !== null;
    }

    restart() {
        if (this.image_url) new_game_from_image(this.image_url);
        else new_game();
    }
}
