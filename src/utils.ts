const genRandomChar = (radix: number): string => {
    return Math.floor(Math.random() * radix)
        .toString(radix)
        .toLocaleUpperCase()
}

export const genRandomStr = (len: number): string => {
    const id = []
    for (const _ of ' '.repeat(len)) {
        id.push(genRandomChar(36))
    }
    return id.join('')
}

export const genRandomHex = (len: number): string => {
    const id = []
    for (const _ of ' '.repeat(len)) {
        id.push(genRandomChar(16))
    }
    return id.join('')
}

export const SAPERATOR = '/'

export const get = (obj: object, path: string | string[] = []): any => {
    for (const p of Array.isArray(path) ? path : path.split(SAPERATOR)) {
        try {
            obj = obj[p]
        } catch (e) {
            if (e instanceof TypeError) {
                return undefined
            } else {
                throw e
            }
        }
    }
    return obj
}

export const getChanges = <T>(
    arrOld: T[],
    arrNew: T[],
    isEqual: (lhs: T, rhs: T) => boolean = (lhs, rhs) => {
        return lhs == rhs
    },
    isSimilar: (lhs: T, rhs: T) => boolean = isEqual
) => {
    type JoinTarget = { oi?: number; ni?: number; mod?: boolean }
    const existInJT = (
        arr: JoinTarget[],
        target: 'oi' | 'ni',
        index: number
    ): boolean => {
        for (const jt of arr) {
            if (jt[target] == index) return true
        }
        return false
    }
    const getJTEdgeIndex = (
        arr: JoinTarget[],
        target: 'oi' | 'ni',
        max?: boolean
    ): number => {
        let m = max ? 0 : Infinity
        arr.forEach((jt) => {
            m = max
                ? jt[target] > m
                    ? jt[target]
                    : m
                : jt[target] < m
                ? jt[target]
                : m
        })
        return m
    }
    const jt: JoinTarget[] = []
    const _old = [...arrOld]
    const _new = [...arrNew]
    let o: number, n: number
    o = 0
    while (typeof _old[o] != 'undefined') {
        const target: 'oi' | 'ni' = 'oi'
        n = jt.length ? getJTEdgeIndex(jt, 'ni', true) + 1 : 0
        if (o != 0 && isEqual(_old[o], _old[o - 1])) {
            jt.unshift({
                oi: o,
                ni: null,
            })
            o += 1
            continue
        }
        let added = false
        while (typeof _new[n] != 'undefined') {
            if (isSimilar(_old[o], _new[n])) {
                jt.unshift({
                    oi: o,
                    ni: n,
                })
                n = 0
                added = true
                break
            }
            n += 1
        }
        if (!added) {
            jt.unshift({
                oi: o,
                ni: null,
            })
        }
        o += 1
    }
    n = 0
    while (typeof _new[n] != 'undefined') {
        const target: 'oi' | 'ni' = 'ni'
        o = n == 0 ? 0 : jt.length ? getJTEdgeIndex(jt, 'oi', true) : 0
        let added = false
        while (typeof _old[o] != 'undefined') {
            if (isSimilar(_old[o], _new[n])) {
                o = 0
                added = true
                break
            }
            o += 1
        }
        if (!added) {
            jt.unshift({
                oi: null,
                ni: n,
            })
        }
        while (existInJT(jt, target, n)) {
            n += 1
        }
    }
    jt.sort((a, b) => {
        return a['oi'] - b['oi']
    })
    const fin: JoinTarget[] = jt.filter((_j) => {
        return _j['oi'] != null
    })
    const _nt: JoinTarget[] = jt.filter((_j) => {
        return _j['ni'] != null && _j['oi'] == null
    })
    _nt.sort((a, b) => {
        return b['ni'] - a['ni']
    })
    const _ins: number[] = []
    _nt.forEach((_j) => {
        let _len = _ins.length
        for (const i in fin) {
            if (_j['ni'] < fin[i]['ni']) {
                _ins.push(parseInt(i))
                break
            }
        }
        if (_len == _ins.length) {
            _ins.unshift(fin.length)
        }
    })
    for (const i in _nt) {
        fin.splice(_ins[i], 0, _nt[i])
    }
    return fin.map((_item) => {
        if (_item['ni'] != null && _item['oi'] != null) {
            if (!isEqual(_old[_item['oi']], _new[_item['ni']])) {
                return { ..._item, mod: true }
            }
        }
        return _item
    })
}
