import { readFile, readdir } from 'fs/promises';
import { dirname, extname } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { DocumentId, DocumentStage, DocumentVersion } from '../domain/types.js';
import type { DocumentMetadata } from '../domain/document-metadata.js';
import { DocumentType } from '../domain/document-metadata.js';
import type { IDocumentExtractor } from '../domain/types.js';
import { logger } from '../shared/logger.js';

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  isArray: (name) => {
    return name === 'docidentifier' || name === 'date' || name === 'title';
  }
});

interface ParsedRxl {
  bibdata: {
    docidentifier?: Array<{
      '#text'?: string;
      '@_type'?: string;
      '@_primary'?: string;
    }>;
    edition?: string | { '#text'?: string };
    status?: {
      stage:
        | string
        | {
            '#text'?: string;
            '@_value'?: string;
            '@_abbreviation'?: string;
          };
      substage?: { '@_value'?: string } | string;
    };
    title?: Array<{
      '#text'?: string;
      '@_language'?: string;
      '@_type'?: string;
    }>;
    doctype?: string | { '#text'?: string };
    date?: Array<{
      '@_type'?: string;
      on?: string;
      '#text'?: string;
    }>;
    ext?: {
      flavor?: string;
    };
  };
}

export class RxlExtractor implements IDocumentExtractor {
  async extract(rxlPath: string): Promise<DocumentMetadata> {
    const xml = await readFile(rxlPath, 'utf-8');
    const parsed = XML_PARSER.parse(xml) as ParsedRxl;

    const bibdata = parsed.bibdata;
    if (!bibdata) {
      throw new Error(`No bibdata found in ${rxlPath}`);
    }

    const rawId = this.extractPrimaryDocIdentifier(bibdata);
    const id = DocumentId.fromRaw(rawId);

    const edition = this.extractText(bibdata.edition);
    const stage = this.extractStage(bibdata);
    const title = this.extractTitle(bibdata);
    const doctype = this.extractText(bibdata.doctype) ?? '';
    const revdate = this.extractRevdate(bibdata);
    const flavor = bibdata.ext?.flavor;

    const outputDir = dirname(rxlPath);
    const formats = await this.detectFormats(outputDir);
    const sourcePath = this.resolveSourcePath(outputDir);
    const documentType = this.detectDocumentType(rawId);
    const version = DocumentVersion.from(edition, stage);

    return {
      id,
      title,
      version,
      doctype,
      documentType,
      flavor,
      revdate,
      sourcePath,
      outputDir,
      formats
    };
  }

  private extractPrimaryDocIdentifier(bibdata: ParsedRxl['bibdata']): string {
    const identifiers = bibdata.docidentifier;
    if (!identifiers || identifiers.length === 0) {
      throw new Error('No docidentifier found in bibdata');
    }

    const primary = identifiers.find((id) => id['@_primary'] === 'true');
    if (primary?.['#text']) {
      return primary['#text'];
    }

    const first = identifiers[0];
    if (first?.['#text']) {
      return first['#text'];
    }

    throw new Error('No valid docidentifier text found');
  }

  private extractStage(bibdata: ParsedRxl['bibdata']): DocumentStage {
    const status = bibdata.status;
    if (!status) {
      return DocumentStage.fromStatus('published');
    }

    const stageNode = status.stage;
    const stageText = this.extractTextFromNode(stageNode);
    const stageValue =
      typeof stageNode === 'object' && stageNode !== null
        ? stageNode['@_value']
        : undefined;
    const substageNode = status.substage;
    const substageValue =
      typeof substageNode === 'object' && substageNode !== null
        ? substageNode['@_value']
        : undefined;
    const substageText = this.extractTextFromNode(substageNode);

    const numericStage = stageValue ?? (stageText && /^\d+$/.test(stageText) ? stageText : undefined);
    const numericSubstage = substageValue ?? (substageText && /^\d+$/.test(substageText) ? substageText : undefined);

    if (numericStage && /^\d+$/.test(numericStage)) {
      return DocumentStage.fromIsoStage(
        parseInt(numericStage, 10),
        parseInt(numericSubstage ?? '0', 10)
      );
    }

    if (stageText) {
      try {
        return DocumentStage.fromStatus(stageText);
      } catch {
        // Fall through
      }
    }

    return DocumentStage.fromStatus('published');
  }

  private extractTitle(bibdata: ParsedRxl['bibdata']): string {
    const titles = bibdata.title;
    if (!titles || titles.length === 0) return '';

    const mainTitle = titles.find(
      (t) => t['@_type'] === 'main' && t['@_language'] === 'en'
    );
    if (mainTitle?.['#text']) return mainTitle['#text'];

    const englishTitle = titles.find((t) => t['@_language'] === 'en');
    if (englishTitle?.['#text']) return englishTitle['#text'];

    const first = titles[0];
    return first?.['#text'] ?? '';
  }

  private extractRevdate(bibdata: ParsedRxl['bibdata']): string | undefined {
    const dates = bibdata.date;
    if (!dates || dates.length === 0) return undefined;

    const published = dates.find((d) => d['@_type'] === 'published');
    if (published?.on) return published.on;
    if (published?.['#text']) return published['#text'];

    return undefined;
  }

  private extractText(
    value: string | { '#text'?: string } | undefined
  ): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'string') return value;
    return value['#text'];
  }

  private extractTextFromNode(
    value: string | { '#text'?: string; [key: string]: unknown } | undefined
  ): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'string') return value;
    return value['#text'];
  }

  private async detectFormats(outputDir: string): Promise<string[]> {
    const extensions: string[] = [];
    try {
      const files = await readdir(outputDir);
      const seen = new Set<string>();
      for (const file of files) {
        const ext = extname(file).toLowerCase().replace('.', '');
        if (ext && !seen.has(ext) && ext !== 'rxl') {
          seen.add(ext);
          extensions.push(ext);
        }
      }
    } catch {
      // no formats detected
    }
    return extensions;
  }

  private resolveSourcePath(outputDir: string): string {
    const normalized = outputDir.replace(/\\/g, '/');
    const documentsIdx = normalized.indexOf('/documents/');
    if (documentsIdx === -1) return '';

    const relative = normalized.slice(documentsIdx + '/documents/'.length);
    const parts = relative.split('/');
    const docDir = parts[parts.length - 1];

    const sourceParts = parts.slice(0, -1);
    sourceParts.push(`${docDir}.adoc`);
    return sourceParts.join('/');
  }

  detectDocumentType(rawId: string): DocumentType {
    if (/^RFC\s/i.test(rawId)) return DocumentType.IetfRfc;
    if (/^draft-/i.test(rawId)) return DocumentType.IetfDraft;
    return DocumentType.Standard;
  }
}

export async function discoverDocuments(
  outputDir: string,
  extractor: IDocumentExtractor
): Promise<DocumentMetadata[]> {
  const { glob } = await import('glob');
  const rxlFiles = await glob('**/*.rxl', { cwd: outputDir, absolute: true });

  const results: DocumentMetadata[] = [];

  for (const rxl of rxlFiles) {
    try {
      const metadata = await extractor.extract(rxl);
      results.push(metadata);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to extract metadata from ${rxl}: ${message}`);
    }
  }

  return results;
}
