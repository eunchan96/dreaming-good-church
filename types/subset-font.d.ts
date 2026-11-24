declare module "subset-font" {
  export default function subsetFont(font: Buffer | Uint8Array, text: string, options?: { targetFormat?: "sfnt" | "truetype" | "woff" | "woff2"; preserveNameIds?: number[]; variationAxes?: Record<string, number> }): Promise<Buffer>;
}
