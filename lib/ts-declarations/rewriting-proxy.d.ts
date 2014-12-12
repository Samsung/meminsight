declare module "rewriting-proxy" {

    export interface RewriteMetadata {
        url: string
    }

    export interface ProxyOptions {
        rewriter: (src: string, metadata: RewriteMetadata) => string
        intercept: (url: string) => string
        headerCode?: string
        headerURLs?: Array<string>
        port?: number
    }
    export function start(options: ProxyOptions): void
}