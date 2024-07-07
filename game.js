'use strict';


var TIME_UNITS_PER_DAY = 60 * 60 * 24;
var MIDNIGHT = 0;
var DAWN = TIME_UNITS_PER_DAY * (1 / 4);
var NOON = TIME_UNITS_PER_DAY * (2 / 4);
var SUNSET = TIME_UNITS_PER_DAY * (3 / 4);


var DEFAULT_PORTAL_WIDTH = 16;
var DEFAULT_PORTAL_HEIGHT = 16;


var DEFAULT_GAMEDATA = {
    width: 300,
    height: 200,
    zoom: 3,
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
        var zoom = gamedata.zoom;

        // NOTE: pixels is an optional Uint32Array
        this.canvas = canvas;
        this.width = width;
        this.height = height;
        this.zoom = zoom;
        this.image_url = image_url || null;
        this.time = gamedata.time;
        this.timeout_handle = null;

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

    render() {
        // Render people to this.pixels
        for (var person of this.people) person.render_pixels();

        // Create a copy of this.pixels, so we can draw more stuff
        // without affecting our particular simulation
        var pixels = this.pixels.slice();

        // Render portals to pixels
        var portal_color = get_portal_color(this.time);
        for (var portal of this.portals) {
            draw_rect(pixels, this.width,
                portal.x, portal.y, portal.width, portal.height,
                portal_color);
        }

        // Draw pixels onto canvas
        draw_pixels_on_canvas(pixels, this.canvas);
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
        if (this.portal_activated) return;

        if (this.mousedown) { this.dropstuff(); }

        // Tick... tick... tick...
        this.time = (this.time + 1) % TIME_UNITS_PER_DAY;

        // Game physics!
        shuffle(this.indexes);
        for (var i of this.indexes) {
            var x = i % this.width;
            var y = Math.floor(i / this.width);
            var material = this.pixels[i];

            // Falling physics
            if (does_fall(material)) {
                var supported = (
                    (
                        supports(this.get_pixel(x - 1, y), material) &&
                        supports(this.get_pixel(x + 1, y), material)
                    ) ||
                    supports(this.get_pixel(x - 1, y - 1), material) ||
                    supports(this.get_pixel(x + 1, y - 1), material)
                );
                if (supported) {
                    // Don't fall!
                } else if (this.move_pixel(x, y, x, y + 1)) {
                    // We fell straight down
                } else if (!does_fall_straight(material)) {
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
