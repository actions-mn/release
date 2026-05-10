import { readFile, readdir } from 'fs/promises';
import { basename, dirname, extname } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { DocumentId, DocumentStage, DocumentVersion } from '../domain/types.js';
import type { DocumentMetadata } from '../domain/document-metadata.js';
import { DocumentType } from '../domain/document-metadata.js';
import type { IDocumentExtractor } from '../domain/types.js';
import { textOf, type ParsedRxl, type XmlNode } from '../domain/rxl-schema.js';
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

export class RxlExtractor implements IDocumentExtractor {
  async discover(outputDir: string): Promise<DocumentMetadata[]> {
    const { glob } = await import('glob');
    const rxlFiles = await glob('**/*.rxl', { cwd: outputDir, absolute: true });

    const results: DocumentMetadata[] = [];

    for (const rxl of rxlFiles) {
      try {
        const metadata = await this.extract(rxl);
        results.push(metadata);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to extract metadata from ${rxl}: ${message}`);
      }
    }

    return results;
  }

  async extract(rxlPath: string): Promise<DocumentMetadata> {
    const xml = await readFile(rxlPath, 'utf-8');
    const parsed = XML_PARSER.parse(xml) as ParsedRxl;

    const bibdata = parsed.bibdata;
    if (!bibdata) {
      throw new Error(`No bibdata found in ${rxlPath}`);
    }

    const rawId = this.extractPrimaryDocIdentifier(bibdata);
    const id = DocumentId.fromRaw(rawId);

    const edition = textOf(bibdata.edition as XmlNode);
    const stage = this.extractStage(bibdata);
    const title = this.extractTitle(bibdata);
    const doctype = textOf(bibdata.doctype as XmlNode) ?? '';
    const revdate = this.extractRevdate(bibdata);
    const flavor = bibdata.ext?.flavor;

    const outputDir = dirname(rxlPath);
    const formats = await this.detectFormats(outputDir);
    const sourcePath = this.resolveSourcePath(outputDir);
    const documentType = DocumentType.fromIdentifier(rawId);
    const version = DocumentVersion.from(edition, stage);
    const fileBaseName = basename(rxlPath, extname(rxlPath));

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
      formats,
      fileBaseName
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
    const stageText = textOf(stageNode as XmlNode);
    const stageValue =
      typeof stageNode === 'object' && stageNode !== null
        ? stageNode['@_value']
        : undefined;
    const substageNode = status.substage;
    const substageValue =
      typeof substageNode === 'object' && substageNode !== null
        ? substageNode['@_value']
        : undefined;
    const substageText = textOf(substageNode as XmlNode);

    const numericStage =
      stageValue ??
      (stageText && /^\d+$/.test(stageText) ? stageText : undefined);
    const numericSubstage =
      substageValue ??
      (substageText && /^\d+$/.test(substageText) ? substageText : undefined);

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
}
