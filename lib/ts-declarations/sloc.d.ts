declare module "sloc" {

    function internal(contents: string, language: string): { source: number };

    export = internal;
}