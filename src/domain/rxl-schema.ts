export interface RxlDocIdentifier {
  '#text'?: string;
  '@_type'?: string;
  '@_primary'?: string;
}

export interface RxlDate {
  '@_type'?: string;
  on?: string;
  '#text'?: string;
}

export interface RxlTitle {
  '#text'?: string;
  '@_language'?: string;
  '@_type'?: string;
}

export interface RxlStage {
  '#text'?: string;
  '@_value'?: string;
  '@_abbreviation'?: string;
}

export interface RxlBibdata {
  docidentifier?: RxlDocIdentifier[];
  edition?: string | { '#text'?: string };
  status?: {
    stage: string | RxlStage;
    substage?: { '@_value'?: string } | string;
  };
  title?: RxlTitle[];
  doctype?: string | { '#text'?: string };
  date?: RxlDate[];
  ext?: {
    flavor?: string;
  };
}

export interface ParsedRxl {
  bibdata: RxlBibdata;
}

export type XmlNode = string | { '#text'?: string } | undefined;

export function textOf(node: XmlNode): string | undefined {
  if (node === undefined) return undefined;
  if (typeof node === 'string') return node;
  return node['#text'];
}
