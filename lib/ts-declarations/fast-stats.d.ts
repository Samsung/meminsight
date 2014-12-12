declare module "fast-stats" {
    export class Stats {
        constructor();

        push(...args: number[]): Stats;

        amean(): number;

        gmean(): number;

        stddev(): number;
    }


}