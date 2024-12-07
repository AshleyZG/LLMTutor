class Observable<T> {
    private _value: T;
    private listeners: Array<(newValue: T, oldValue: T) => void> = [];

    constructor(initialValue: T) {
        this._value = initialValue;
    }

    get value() {
        return this._value;
    }

    set value(newValue: T) {
        const oldValue = this._value;
        this._value = newValue;
        this.notifyListeners(newValue, oldValue);
    }

    subscribe(listener: (newValue: T, oldValue: T) => void) {
        this.listeners.push(listener);
    }

    private notifyListeners(newValue: T, oldValue: T) {
        for (const listener of this.listeners) {
            listener(newValue, oldValue);
        }
    }
}

export default Observable;

