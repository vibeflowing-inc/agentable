import type { Request, Response, NextFunction } from 'express'
import type { AgentableServer } from '../index.js'

export function expressHandler(agentable: AgentableServer) {
  return async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    // Build a full URL so the handler can parse the pathname
    const protocol = req.protocol ?? 'http'
    const host = req.get('host') ?? 'localhost'
    const fullUrl = `${protocol}://${host}${req.originalUrl}`

    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key] = value
      } else if (Array.isArray(value)) {
        headers[key] = value.join(', ')
      }
    }

    let body: string | null = null

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // If express.json() (or similar body-parsing middleware) has already parsed
      // the body, use that. Otherwise fall back to reading the raw stream.
      if (req.body !== undefined) {
        body = JSON.stringify(req.body)
        headers['content-type'] = 'application/json'
      } else {
        const bodyChunks: Buffer[] = []
        await new Promise<void>((resolve, reject) => {
          req.on('data', (chunk: Buffer) => bodyChunks.push(chunk))
          req.on('end', resolve)
          req.on('error', reject)
        })
        body = bodyChunks.length > 0 ? Buffer.concat(bodyChunks).toString() : null
      }
    }

    const webRequest = new Request(fullUrl, {
      method: req.method,
      headers,
      body,
    })

    const webResponse = await agentable.handler(webRequest)

    res.status(webResponse.status)
    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    const responseBody = await webResponse.text()
    res.send(responseBody)
  }
}
