'use strict';


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


function css_rgb(r, g, b, a) {
    // https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/rgb
    // Each value can be represented as a <number> between 0 and 255,
    // a <percentage> between 0% and 100%, or the keyword none
    // (equivalent to 0% in this case).
    if (a === undefined) a = 1;
    else a = a / 255;
    return `rgb(${r}, ${g}, ${b}, ${a})`;
}

function css_hsl(h, s, l, a) {
    // https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl
    // H: A <number>, an <angle>, or the keyword none (equivalent to
    // 0deg in this case) representing the color's <hue> angle.
    // S: A <percentage> or the keyword none (equivalent to 0% in this
    // case). This value represents the color's saturation. Here 100%
    // is completely saturated, while 0% is completely unsaturated (gray).
    // L: A <percentage> or the keyword none (equivalent to 0% in this
    // case). This value represents the color's lightness. Here 100%
    // is white, 0% is black, and 50% is "normal".
    if (a === undefined) a = 1;
    else a = a / 255;
    return `hsl(${h} ${s} ${l} /${a})`;
}

function css_material(material) {
    var rgba = unpack_rgb(material);
    return css_rgb(rgba[0], rgba[1], rgba[2], rgba[3]);
}


function draw_rect(pixels, width, x0, y0, w, h, c) {
    // NOTE: pixels is a Uint32Array

    var height = pixels.length / width;

    var x1 = x0 + w;
    var y1 = y0 + h;

    // These are used in the for-loops
    var _x0 = x0, _y0 = y0, _x1 = x1, _y1 = y1;
    if (_x0 < 0) _x0 = 0;
    else if (_x0 >= width) _x0 = width - 1;
    if (_y0 < 0) _y0 = 0;
    else if (_y0 >= height) _y0 = height - 1;
    if (_x1 < 0) _x1 = 0;
    else if (_x1 >= width) _x1 = width - 1;
    if (_y1 < 0) _y1 = 0;
    else if (_y1 >= height) _y1 = height - 1;

    // Top
    if (y0 >= 0 && y0 < height) {
        var i = y0 * width;
        for (var x = _x0; x <= _x1; x++) pixels[i + x] = c;
    }

    // Bottom
    if (y1 >= 0 && y1 < height) {
        var i = y1 * width;
        for (var x = _x0; x <= _x1; x++) pixels[i + x] = c;
    }

    // Left
    if (x0 >= 0 && x0 < width) {
        var i0 = (_y0 + 1) * width + x0;
        var i1 = (_y1 - 1) * width + x0;
        for (var i = i0; i <= i1; i += width) pixels[i] = c;
    }

    // Right
    if (x1 >= 0 && x1 < width) {
        var i0 = (_y0 + 1) * width + x1;
        var i1 = (_y1 - 1) * width + x1;
        for (var i = i0; i <= i1; i += width) pixels[i] = c;
    }
}


function rect_collide(ax0, ay0, aw, ah, bx0, by0, bw, bh) {
    var ax1 = ax0 + aw;
    var ay1 = ay0 + ah;
    var bx1 = bx0 + bw;
    var by1 = by0 + bh;
    return (
        ax1 >= bx0 && bx1 >= ax0 &&
        ay1 >= by0 && by1 >= ay0
    );
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


function draw_pixels_on_canvas(pixels, canvas) {
    // NOTE: pixels is a Uint32Array
    var pixel_data = new Uint8ClampedArray(pixels.buffer);
    var data = new ImageData(pixel_data, canvas.width, canvas.height);
    var ctx = canvas.getContext('2d');
    ctx.putImageData(data, 0, 0);
}


function deserialize(obj, data) {
    // Copy keys of data onto obj

    if (obj === null || typeof obj !== 'object') return;
    if (Array.isArray(obj)) return; // we dunno how to populate arrays

    // If we get this far, obj is an object, like a custom class instance
    for (var key of obj.SERIALIZE_FIELDS) {
        if (!(key in data)) continue;
        var value = data[key];
        if (Array.isArray(value)) continue; // we dunno how to populate arrays
        obj[key] = value;
    }
}


function serialize(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(serialize);

    // If we get this far, obj is an object, like a custom class instance
    var data = {};
    for (var key of obj.SERIALIZE_FIELDS) {
        data[key] = serialize(obj[key]);
    }
    return data;
}
