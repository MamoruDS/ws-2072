import axios from 'axios'
import { options as OPT } from './main'

const parseGitPatch = require('parse-git-patch')

type CommitInfo = {
    owner: string
    repo: string
    commit_id: string
}

type fetchInfo = {
    err: boolean
    status: number
    response: object
}

const fetch = async (
    url: string,
    method: 'POST' | 'GET',
    headers?: { [header: string]: string }
): Promise<fetchInfo> => {
    try {
        const res = await axios({
            url: url,
            method: method,
            headers: headers,
        })
        return {
            err: false,
            status: res.status,
            response: res.data,
        }
    } catch (e) {
        return {
            err: true,
            status: e['response']['status'],
            response: e['response'],
        }
    }
}

type Patch = {
    hash: string
    date: string
    message: string
    authorEmail: string
    authorName: string
    files: {
        added: boolean
        deleted: boolean
        beforeName: string
        afterName: string
        modifiedLines: {
            line: string
            lineNumber: number
            added: boolean
        }[]
    }[]
}

const parsePatch = (patch: string): Patch => {
    return parseGitPatch(PATCH_HEAD + '\n' + patch)
}

export const parseCommitUri = (commitUri: string): CommitInfo => {
    const re = new RegExp(
        /github.com\/([^\/]{1,})\/([^\/]{1,})\/commit\/([\w]{1,})/g
    )
    const match = re.exec(commitUri)
    const owner = match[1]
    const repo = match[2]
    const commit = match[3]
    return {
        owner: owner,
        repo: repo,
        commit_id: commit,
    }
}

export type PatchFile = {
    sha: string
    filename: string
    status: 'modified'
    additions: number
    deletions: number
    changes: number
    blob_url: string
    raw_url: string
    contents_url: string
    patch: string
    modified_lines: {
        line: string
        lineNumber: number
        added: boolean
    }[]
    raw: string
}

export const fetchCommit = async (commitUri: string): Promise<PatchFile[]> => {
    const commit = parseCommitUri(commitUri)
    const apiUri = `https://api.github.com/repos/${commit.owner}/${commit.repo}/commits/${commit.commit_id}`
    const res = await fetch(apiUri, 'GET', {
        Authorization: OPT.githubToken ? `token ${OPT.githubToken}` : ' ',
    })
    if (res.err) {
        if (res.status == 422) {
            return []
        }
        // TODO:
        return []
    } else {
        const data = res.response as {
            files: {
                sha: string
                filename: string
                // status: 'modified' | 'added' | 'removed'
                status: 'modified'
                additions: number
                deletions: number
                changes: number
                blob_url: string
                raw_url: string
                contents_url: string
                // patch?: string
                patch: string
            }[]
        }
        const files = [] as PatchFile[]
        for (let f of data.files) {
            // file filter
            if (f.filename.slice(-2) !== 'py') continue
            if (f.status !== 'modified') continue

            const patchFile: PatchFile = {
                ...f,
                modified_lines: parsePatch(f.patch).files[0].modifiedLines,
                raw: '',
            }

            const res = await fetch(patchFile.raw_url, 'GET', {})
            if (res.err) {
                //
            } else {
                patchFile['raw'] = `${res.response}`
                files.push(patchFile)
            }
        }
        return files
    }
}

const PATCH_HEAD = `From 0f6f88c98fff3afa0289f46bf4eab469f45eebc6 Mon Jan 01 00:00:00 2000
From: Coder <code@code.com>
Date: Mon, 01 Jan 2000 00:00:00 +0000
Subject: [PATCH] code's change patch
 
---
 src/code.py | 4 +++-
 1 file changed, 3 insertions(+), 1 deletion(-)
 
diff --git a/src/code.py b/src/code.py
index 20bf454..c0fdafb 100644
--- a/src/code.py
+++ b/src/code.py`
