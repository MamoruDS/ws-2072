import { spawnSync } from 'child_process'
import { genRandomHex } from './utils'
import * as fs from 'fs'

const PYBIN_PATH = 'python'

export const getAST = (
    code: string
): {
    err: boolean
    ast_count: number
    ast_object: object
} => {
    const res = {
        err: false,
        ast_count: 0,
        ast_object: {},
    }
    const filename = `temp/${genRandomHex(6)}.py`
    fs.writeFileSync(filename, code)

    let astProc = spawnSync(PYBIN_PATH, ['ast_nodes.py', filename], {
        encoding: 'utf-8',
    })
    fs.unlinkSync(filename)
    if (astProc.status != 0) {
        return { ...res, err: true }
    } else {
        const astRes = JSON.parse(astProc.stdout)
        return {
            ...res,
            ast_count: parseInt(astRes['ast_count']),
            ast_object: astRes['ast_json'],
        }
    }
}
