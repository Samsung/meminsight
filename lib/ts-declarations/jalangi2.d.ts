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

    export interface RecordResult {
        exitCode: number
        stdout: string;
        stderr : string;
        traceFile : string
    }

    export interface ReplayResult<T> {
        exitCode: number
        stdout: string
        stderr: string
        result: T
    }

    export interface InstDirResult {
        outputDir: string
    }

    export function instrument(script: string, options: InstrumentOptions) : InstResult
    export function instrumentString(code: string, options: InstrumentOptions): InstStringResult
    export function instrumentDir(options: any): Q.Promise<InstDirResult>
    export function record (file: string, traceFile? : string) :Q.Promise<RecordResult>
    export function replay <T> (trace : string, analysis : any, options? : Object) : Q.Promise<ReplayResult<T>>
    export function direct <T> (script : string, analysis : Array<string>, options? : Object) : Q.Promise<ReplayResult<T>>
    export function direct2 <T> (script : string, analysis : Array<string>, options? : Object) : Q.Promise<ReplayResult<T>>

    export interface Analysis {
        installAxiom (c: any): any
        makeConcolic  (idx: any, val: any, getNextSymbol: any): any
        makeConcolicPost(): any
        declare(iid: number, name: string, val: any, isArgument: boolean): any
        literalPre(iid: number, val: any, hasGetterSetter: boolean): void
        literal (iid: number, val: any, hasGetterSetter: boolean): any
        invokeFunPre (iid: number, f: any, base: any, args: any, isConstructor: boolean): void
        invokeFun (iid: number, f: any, base: any, args: any, val: any, isConstructor: boolean): any
        getFieldPre(iid: number, base: any, offset: any): void
        getField (iid: number, base: any, offset: any, val: any): any
        putFieldPre (iid: number, base: any, offset: any, val: any): any
        putField (iid: number, base: any, offset: any, val: any): any
        readPre (iid: number, name: any, val: any, isGlobal: boolean): void
        read (iid: number, name: any, val: any, isGlobal: boolean): any
        writePre (iid: number, name: any, val: any, oldValue: any): void
        write (iid: number, name: any, val: any, oldValue: any): any
        binaryPre(iid: number, op: string, left: any, right: any): void
        binary (iid: number, op: string, left: any, right: any, result_c: any): any
        unaryPre (iid: number, op: string, left: any): void
        unary  (iid: number, op: string, left: any, result_c: any): any
        conditionalPre  (iid: number, left: any): void
        conditional(iid: number, left: any, result_c: any): any
        beginExecution  (data: any): void
        endExecution (): any
        functionEnter(iid: number, fun: any, dis: any /* this */, args: any): void
        functionExit  (iid: number): boolean
        return_(val: any): any
        scriptEnter  (iid: number, fileName: string): void
        scriptExit  (iid: number): void
    }
}

//declare var J$ : any
