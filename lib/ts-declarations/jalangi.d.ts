/// <reference path="Q.d.ts"/>

declare var J$:Sandbox;

interface InvokeFunPreResult {
    f: any
    base: any
    args: any[]
    skip: boolean
}
interface Result {
    result: any
}
interface GetFieldPreResult {
    base: any
    offset: any
    skip: boolean
}
interface PutFieldPreResult {
    base: any
    offset: any
    val: any
    skip: boolean
}
interface FunctionExitResult {
    returnVal: any
    exceptionVal: any
    isBacktrack: boolean
}
interface ScriptExitResult {
    exceptionVal: any
    isBacktrack: boolean
}
interface BinaryPreResult {
    op: string
    left: any
    right: any
    skip: boolean
}
interface UnaryPreResult {
    op: string
    left: any
    skip: boolean
}
interface InstrumentCodePreResult {
    code: string
    skip: boolean
}
interface AST {

}
interface JalangiAnalysis {
    invokeFunPre?(iid:number, f:Function, base:any, args:any[], isConstructor:boolean, isMethod:boolean) :InvokeFunPreResult

    invokeFun?(iid:number, f:Function, base:any, args:any, result:any, isConstructor:boolean, isMethod:boolean): Result

    literal?(iid:number, val:any, hasGetterSetter:boolean): Result

    forinObject?(iid:number, val:any): Result

    declare?(iid:number, name:string, val:any, isArgument:boolean, argumentIndex:number, isCatchParam:boolean):Result

    getFieldPre?(iid:number, base:any, offset:any, isComputed:boolean, isOpAssign:boolean, isMethodCall:boolean):GetFieldPreResult

    getField?(iid:number, base:any, offset:any, val:any, isComputed:boolean, isOpAssign:boolean, isMethodCall:boolean): Result

    putFieldPre?(iid:number, base:any, offset:any, val:any, isComputed:boolean, isOpAssign:boolean): PutFieldPreResult

    putField?(iid:number, base:any, offset:any, val:any, isComputed:boolean, isOpAssign:boolean): Result

    read?(iid:number, name:string, val:any, isGlobal:boolean, isPseudoGlobal:boolean): Result

    write?(iid:number, name:string, val:any, lhs:string, isGlobal:boolean, isPseudoGlobal:boolean): Result

    functionEnter?(iid:number, f:Function, dis:any, args:any[]): void

    functionExit?(iid:number, returnval:any, exceptionVal:any) : FunctionExitResult

    scriptEnter?(iid:number, instrumentedFileName:string, originalFileName:string): void

    scriptExit?(iid:number, exceptionVal:any):ScriptExitResult

    binaryPre?(iid:number, op:string, left:any, right:any, isOpAssign:boolean, isSwitchCaseComparison:boolean): BinaryPreResult

    binary?(iid:number, op:string, left:any, right:any, result:any, isOpAssign:boolean, isSwitchCaseComparison:boolean):Result

    unaryPre?(iid:number, op:string, left:any): UnaryPreResult

    unary?(iid:number, op:string, left:any, result:any):Result

    conditional?(iid:number, result:boolean):Result

    instrumentCodePre?(iid:number, code:string): InstrumentCodePreResult

    instrumentCode?(iid:number, newCode:string, newAst:AST): Result

    endExecution?: EndExecutionFunction

    endExpression?(iid: number): void
}
interface AstUtil {
    // TODO improve
    serialize: Function;
    deserialize: Function;
    JALANGI_VAR: string
    CONTEXT: number;
    transformAst: Function;
    computeTopLevelExpressions: Function
}
interface Sandbox {
    analysis?: JalangiAnalysis
    endExecution?: EndExecutionFunction
    instrumentCode?: InstrumentCodeFunction
    instrumentEvalCode?: InstrumentEvalCodeFunction
    iids?: any
    ast_info?: any
    astUtil?: AstUtil
    Constants: any
    Config: any
    initParams?: any
    sid: number
}
interface EndExecutionFunction {
    (): void
}

interface AST {

}
interface SourceMapObject {
}
interface InstrumentCodeResult {
    code: string
    instAST: AST
    sourceMapObject: SourceMapObject
    sourceMapString: string
}
interface InstrumentCodeOptions {
    isEval?: boolean
    code: string
    thisIid?: number
    origCodeFileName?: string
    instCodeFileName?: string
    inlineSourceMap?: boolean
    inlineSource?: boolean
    url?: string
}
interface InstrumentEvalCodeFunction {
    (code:string, iid:number): string
}
interface InstrumentCodeFunction {
    (options:InstrumentCodeOptions): InstrumentCodeResult
}

// Misc meta.
interface JSONable {
    toJSON: Function
}

interface ASTAnalysis {
    (instrumentedAst:AST): {[property:string]: JSONable}
}

interface TransformAstFun {
    // TODO improve
    (object:any, visitorPost:any, visitorPre:any, context:any, noIgnore:any):any
}


declare module "jalangi/src/js/utils/IIDInfo" {
    function internal(g:number):string
    export = internal;
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


    export interface AnalysisResult {
        exitCode: number
        stdout: string
        stderr: string
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
    export function analyze(script : string, analysis : Array<string>, options? : Object) : Q.Promise<AnalysisResult>

}

