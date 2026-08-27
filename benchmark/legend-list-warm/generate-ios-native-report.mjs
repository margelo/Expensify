#!/usr/bin/env node

import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

function readArgument(name) {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return undefined;
    }
    const value = process.argv.at(index + 1);
    if (!value || value.startsWith('--')) {
        throw new Error(`${name} requires a value`);
    }
    return value;
}

function validateRows(rows, implementation, {allowEmpty = false} = {}) {
    if (!Array.isArray(rows) || (!allowEmpty && rows.length === 0)) {
        throw new Error(`${implementation} must contain ${allowEmpty ? 'an array of' : 'at least one'} result row${allowEmpty ? 's' : ''}`);
    }

    const requiredMetrics = ['run', 'durationSeconds', 'cpuSeconds', 'physicalMemoryKB', 'peakPhysicalMemoryKB', 'cpuCyclesKC', 'instructionsKI'];
    const optionalMetrics = ['hitchCount', 'hitchTotalDurationSeconds', 'hitchTimeRatioMsPerS'];
    for (const [index, row] of rows.entries()) {
        if (!row || typeof row !== 'object') {
            throw new Error(`${implementation}[${index}] must be an object`);
        }
        for (const metric of requiredMetrics) {
            if (!Number.isFinite(row[metric])) {
                throw new Error(`${implementation}[${index}].${metric} must be a finite number`);
            }
        }
        for (const metric of optionalMetrics) {
            if (metric in row && !Number.isFinite(row[metric])) {
                throw new Error(`${implementation}[${index}].${metric} must be a finite number when provided`);
            }
        }
    }
}

function validateResults(results) {
    if (!results?.metadata || typeof results.metadata !== 'object') {
        throw new Error('metadata is required');
    }
    if (typeof results.metadata.date !== 'string' || Number.isNaN(Date.parse(`${results.metadata.date}T00:00:00Z`))) {
        throw new Error('metadata.date must use YYYY-MM-DD format');
    }
    validateRows(results.flashlist, 'flashlist', {allowEmpty: true});
    validateRows(results.legendlist, 'legendlist');
}

function serializeForInlineScript(value) {
    return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

async function main() {
    const inputArgument = readArgument('--input');
    const outputArgument = readArgument('--output');
    const templateArgument = readArgument('--template');
    if (!inputArgument || !outputArgument) {
        throw new Error('Usage: node generate-ios-native-report.mjs --input <results.json> --output <report.html> [--template <template.html>]');
    }

    const inputPath = resolve(inputArgument);
    const outputPath = resolve(outputArgument);
    const templatePath = resolve(templateArgument ?? `${scriptDirectory}/ios-native-report.template.html`);
    const [template, resultsText] = await Promise.all([readFile(templatePath, 'utf8'), readFile(inputPath, 'utf8')]);
    const results = JSON.parse(resultsText);
    validateResults(results);

    const placeholder = '/*__BENCHMARK_DATA__*/';
    if (!template.includes(placeholder)) {
        throw new Error(`Template does not contain ${placeholder}`);
    }

    const report = template.replace(placeholder, serializeForInlineScript(results));
    await mkdir(dirname(outputPath), {recursive: true});
    await writeFile(outputPath, report);
    console.log(`Generated ${outputPath}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
