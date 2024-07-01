

var FRAMERATE = 30;


var NOTHING = 'white';
var SAND = 'brown';
var STONE = 'grey';


function is_solid(pixel) {
    return pixel === SAND || pixel === STONE;
}


class SandGame {
    constructor(width, height, pixels_div) {
        this.width = width;
        this.height = height;
        this.pixels_div = pixels_div;
        this.pixel_elems = this.make_grid();
        this.pixels = new Array(width * height);
        this.pixels_next = new Array(width * height);
        this.pixels.fill(NOTHING);
        this.pixels_next.fill(NOTHING);
    }

    make_grid() {
        var pixel_elems = [];
        var div = this.pixels_div;
        for (var y = 0; y < this.height; y++) {
            if (y > 0) {
                var br = document.createElement('br');
                div.appendChild(br);
            }
            for (var x = 0; x < this.width; x++) {
                var pixel_elem = document.createElement('span');
                pixel_elem.className = 'pixel';
                pixel_elem.style.background = 'pink';
                div.appendChild(pixel_elem);
                pixel_elems.push(pixel_elem);
                pixel_elem.x = x;
                pixel_elem.y = y;
                pixel_elem.addEventListener('click', event => {
                    var pixel_elem = event.target;
                    if (event.shiftKey) {
                        var height = this.height;
                        for (var y = pixel_elem.y; y < height; y++) {
                            this.set_pixel(pixel_elem.x, y, STONE);
                        }
                    } else if (event.ctrlKey) {
                        var x0 = pixel_elem.x - 3;
                        var x1 = pixel_elem.x + 3;
                        var y = pixel_elem.y;
                        for (var x = x0; x <= x1; x++) {
                            this.set_pixel(x, y, SAND);
                        }
                    } else {
                        this.set_pixel(pixel_elem.x, pixel_elem.y, SAND);
                    }
                });
            }
        }
        return pixel_elems;
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

    render() {
        var n = this.width * this.height;
        for (var i = 0; i < n; i++) {
            var elem = this.pixel_elems[i];
            var pixel = this.pixels[i];
            elem.style.background = pixel;
        }
    }

    step() {
        // Game physics!
        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                var material = this.get_pixel(x, y);
                if (material === SAND) {
                    if (is_solid(this.get_pixel(x, y + 1))) {
                        if (Math.random() < .5 && !is_solid(this.get_pixel(x - 1, y + 1))) {
                            // We fall down and to the left
                            this.set_pixel(x, y, NOTHING);
                            this.set_pixel(x - 1, y + 1, SAND);
                        } else if (!is_solid(this.get_pixel(x + 1, y + 1))) {
                            // We fall down and to the right
                            this.set_pixel(x, y, NOTHING);
                            this.set_pixel(x + 1, y + 1, SAND);
                        } else {
                            // We stay right where we are!
                            this.set_pixel(x, y, SAND);
                        }
                    } else{
                        // We fall straight down
                        this.set_pixel(x, y, NOTHING);
                        this.set_pixel(x, y + 1, SAND);
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
    var pixels_div = document.getElementById('sandgame');
    var game = new SandGame(300, 300, pixels_div);
    window.game = game;
    game.step();
});
