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
