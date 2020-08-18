import { spawnSync } from 'child_process'
import * as fs from 'fs'
import { parseInt } from 'lodash'
import { genRandom } from './utils'

const PYBIN_PATH = 'python'

export const getAST = (
    code: string
): {
    err: boolean
    ast_count: number
} => {
    const res = {
        err: false,
        ast_count: 0,
    }
    const filename = `temp/${genRandom(6)}.py`
    fs.writeFileSync(filename, code)

    let astProc = spawnSync(PYBIN_PATH, ['ast_nodes.py', filename], {
        encoding: 'utf-8',
    })
    fs.unlinkSync(filename)
    if (astProc.status != 0) {
        return { ...res, err: true }
    } else {
        return { ...res, ast_count: parseInt(astProc.stdout) }
    }
}
