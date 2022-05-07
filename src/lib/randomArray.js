import { getRandomInt } from "./utils.js";

export class RandomArray {
    constructor(array) {
        this._originArray = [...array];
        this._array = [...array];
    }

    reset() {
        this._array = [...this._originArray];
    }

    pop(index) {
        return this._array.splice(index, 1)?.[0];
    }

    next() {
        if (this._array.length == 0) {
            this.reset();
        }

        const rnd = getRandomInt(0, this._array.length);
        return this.pop(rnd);
    }
}

class RandomArrayStore {
    constructor() {
        if (!RandomArrayStore.instance) {
            RandomArrayStore.instance = this;

            this._data = {};
        }

        return RandomArrayStore.instance;
    }

    add(key, value) {
        if (key in this._data) {
            return this._data[key];
        }

        return (this._data[key] = value);
    }

    get(key) {
        return this._data[key];
    }
}

const instance = new RandomArrayStore();
Object.freeze(instance);

export default instance;
