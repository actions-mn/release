import { setFailed, setOutput } from '@actions/core';
import { getInputs } from './input-helper.js';
import { ReleasePipeline } from './pipeline.js';

async function run(): Promise<void> {
  try {
    const config = await getInputs();
    const pipeline = new ReleasePipeline(config);
    const result = await pipeline.execute();

    setOutput(
      'released-documents',
      JSON.stringify(result.released.map((d) => d.id.toString()))
    );
    setOutput(
      'skipped-documents',
      JSON.stringify(result.skipped.map((d) => d.id.toString()))
    );
    setOutput(
      'total-documents',
      result.released.length + result.skipped.length + result.failed.length
    );
    setOutput('metanorma-version', result.metanormaVersion);

    if (result.failed.length > 0) {
      const failedIds = result.failed
        .map((f) => f.document.id.toString())
        .join(', ');
      setFailed(`${result.failed.length} document(s) failed: ${failedIds}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setFailed(`Release failed: ${message}`);
  }
}

run();
