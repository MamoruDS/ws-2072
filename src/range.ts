type CIRange = [number, number]

export class RangeChecker {
    ranges: CIRange[]
    constructor() {
        this.ranges = []
    }
    add(range: CIRange) {
        let _r: CIRange
        if (range[0] > range[1]) {
            _r = [range[1], range[0]]
        } else {
            _r = range
        }
        this.ranges.push(_r)
    }
    collisionWith(range: CIRange): boolean {
        let res = false
        let _r: CIRange
        if (range[0] > range[1]) {
            _r = [range[1], range[0]]
        } else {
            _r = range
        }

        for (const r of this.ranges) {
            if (_r[1] < r[0] || _r[0] > r[1]) {
                // safe
                continue
            } else {
                res = true
                break
            }
        }
        return res
    }
}

