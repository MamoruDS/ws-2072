import { genRandom } from './ast'

const createCsvWriter = require('csv-writer').createObjectCsvWriter

export type DataType = {
    old: string
    new: string
    url: string
    change: 'add' | 'delete'
    cause?: string
    symptom?: string
    remark?: string
}

export const writer = (data: DataType[], output?: string) => {
    const filename = output ? output : genRandom(6) + '.csv'
    console.log('\t>[\x1b[34mINF\x1b[0m] saving to ' + filename)

    const csvWriter = createCsvWriter({
        path: filename,
        header: [
            { id: 'old', title: 'Buggy Code' },
            { id: 'new', title: 'Repair Code' },
            { id: 'url', title: 'Bug address' },
            { id: 'change', title: 'Node Change' },
            { id: 'cause', title: 'cause' },
            { id: 'symptom', title: 'symptom' },
            { id: 'remark', title: 'remark' },
        ],
    })

    csvWriter
        .writeRecords(data)
        .then(() =>
            console.log(
                `All records were written into ${filename} successfully`
            )
        )
}
