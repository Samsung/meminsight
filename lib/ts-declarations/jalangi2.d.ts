/// <reference path="Q.d.ts"/>

declare module "jalangi/src/js/utils/IIDInfo" {
    function internal(g:number):string

export = internal;
}

declare module "jalangi/src/js/ConcolicValue" {
    class ConcolicValue {
        constructor(object : any, annotation : any);
        static getSymbolic(o:any): any;
        static getConcrete(o:any): any;
    }
export = ConcolicValue;
}

declare module "jalangi2/src/js/instrument/instUtil" {
    export function setHeaders(analysis2: boolean): void
    export var headerSources: Array<string>
    export function createFilenameForScript(url: string): string
}


declare module "jalangi2" {
    export interface InstrumentOptions {
        outputFile?: string;
        inputFileName?: string;
        instHandler?: CustomInstHandler;
        inlineSourceMap?: boolean;
        inlineSource?: boolean;
        astHandler?: (ast: any) => any;
    }

    export interface CustomInstHandler {
        instrRead: (name: string, ast: any) => boolean
        instrWrite: (name: string, ast: any) => boolean
        instrGetfield: (offset: string, ast: any) => boolean
        instrPutfield: (offset: string, ast: any) => boolean
        instrBinary: (operator: string, ast: any) => boolean
        instrPropBinaryAssignment: (operator: string, offset: string, ast: any) => boolean
        instrUnary: (operator: string, ast: any) => boolean
        instrLiteral: (literal: any, ast: any) => boolean
        instrConditional: (type: string, ast: any) => boolean
    }

    export interface InstResult {
        outputFile: string;
        iidMapFile: string;
        iidMetadataFile: string;
    }

    export interface InstStringResult {
        code: string;
        instAST: any;
        sourceMapObject: any;
    }


    export interface AnalysisResult<T> {
        exitCode: number
        stdout: string
        stderr: string
        result: T
    }

    export interface InstDirOptions {
        outputDir?: string;
        instHandler?: CustomInstHandler;
        astHandler?: (ast: any) => any;
        inlineIID?: boolean;
    }
    export interface InstDirResult {
        outputDir: string
    }

    export function instrumentString(code: string, options: InstrumentOptions): InstStringResult
    export function instrumentDir(options: InstDirOptions): Q.Promise<InstDirResult>
    export function direct<T> (script : string, analysis : Array<string>, options? : Object) : Q.Promise<AnalysisResult<T>>
    export function direct2<T> (script : string, analysis : Array<string>, options? : Object) : Q.Promise<AnalysisResult<T>>

}

//declare var J$ : any
