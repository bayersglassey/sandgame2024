'use strict';


var TIME_TRACKING = false;


class GameTimer {

    constructor(size) {
        this.size = size || 10;
        this.index = 0;
        this.times = {};
    }

    start() {
        if (!TIME_TRACKING) return;
        this.index = (this.index + 1) % this.size;
        this.t = get_timestamp();
    }

    mark(key) {
        if (!TIME_TRACKING) return;
        var t = get_timestamp();
        var took = t - this.t;
        if (!(key in this.times)) this.times[key] = new Array(this.size);
        this.times[key][this.index] = took;
        this.t = t;
    }

    stats() {
        var stats = {};
        for (var key in this.times) {
            var times = this.times[key];
            var total = 0;
            for (var time of times) total += time;
            var avg = total / this.size;
            stats[key] = avg;
        }
        return stats;
    }
}
