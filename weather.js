'use strict';


class Weather {

    // Our parent Game increments this for us after calling our step().
    age = 0;

    max_age = 100;
    done() {
        // Game calls this before step().
        // If we return true, game removes us instead of calling step().
        // Subclasses can override this if they wanna do something fancy.
        return this.age >= this.max_age;
    }

    step(game) {
        throw new Error("Subclasses should override this!");
    }
}


class DroppingWeather extends Weather {
    // Weather which drops stuff

    material = NOTHING; // Subclasses should override this!

    drops_per_step = 10;

    max_age = 300;

    step(game) {
        var age_percent = this.age / this.max_age;
        var j1 = this.drops_per_step * age_percent;
        for (var j = 0; j <= j1; j++) {
            var x = Math.floor(Math.random() * game.width);
            var y = Math.floor(Math.random() * game.height);
            var i = y * game.width + x;
            if (game.pixels[i] === NOTHING) game.pixels[i] = this.material;
        }
    }
}


class Rain extends DroppingWeather {
    material = WATER;
}

class SandStorm extends DroppingWeather {
    material = SAND;
}
