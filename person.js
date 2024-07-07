'use strict';


class Person {
    KEYS = 'udlrj';
    JUMP = 25;
    JUMP_HANG = 5;

    SERIALIZE_FIELDS = ['x', 'y', 'jump', 'width', 'height'];

    constructor(game, keymap) {
        this.game = game;
        this.keymap = keymap;

        this.x = Math.round(game.width / 2);
        this.y = Math.round(game.height - 1);
        this.jump = 0;
        this.jump_released = true;
        this.width = 1;
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

        for (var portal of this.game.portals) {
            if (!portal.image_url) continue;
            if (!rect_collide(
                this.x, this.y - (this.height - 1), this.width, this.height,
                portal.x, portal.y, portal.width, portal.height,
            )) continue;
            this.game.portal_activated = true;
            new_game_from_image(portal.image_url);
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
                    get_density(pixel) > 0 && (
                        is_pushable(pixel) ||
                        is_denser_or_equal(prev_pixel, pixel)
                    )
                );
                x += dx
            );
            if (get_density(pixel) > 0) continue;
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
        this._render_pixels();
    }
    clear_pixels() {
        this._render_pixels(true);
    }
    _render_pixels(clear) {
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
            pixels[i] = clear? NOTHING: y === y0? SKIN: CLOTHES;
        }
    }
}
