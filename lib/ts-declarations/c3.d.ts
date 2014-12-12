interface C3Chart {
    load(config: any): void
}

interface C3Static {
    generate(config: any): C3Chart
}

declare var c3: C3Static;
