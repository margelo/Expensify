// cspell:words javac chrispader legendlist flashlist dumpsys cooldown thermalservice
/* eslint-disable import/extensions -- Node's native TypeScript loader requires explicit extensions. */
/* eslint-disable no-await-in-loop -- All samples share one physical phone and must execute serially. */
/* eslint-disable no-console -- This is a terminal benchmark runner, not app code. */
import {spawn, execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {homedir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

import type {ScrollFlow} from './android-gesture-plan.ts';

import {gesturePlan, gestureSettings} from './android-gesture-plan.ts';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const save = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const parseJSON = (text: string): unknown => JSON.parse(text);

async function run(command: string, args: string[], {env, logPath}: {env: NodeJS.ProcessEnv; logPath?: string}) {
    const log = logPath ? createWriteStream(logPath, {flags: 'a'}) : undefined;
    const child = spawn(command, args, {
        cwd: root,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
        log?.write(chunk);
        if (log) {
            process.stdout.write(chunk);
        }
    });
    child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        log?.write(chunk);
        if (log) {
            process.stderr.write(chunk);
        }
    });
    const cancel = () => child.kill('SIGTERM');
    process.once('SIGINT', cancel);
    process.once('SIGTERM', cancel);
    try {
        const code = await new Promise<number | null>((accept, reject) => {
            child.once('error', reject);
            child.once('close', accept);
        });
        if (code !== 0) {
            throw new Error(`${command} exited ${code}: ${stderr.slice(-3000)}`);
        }
        return stdout;
    } finally {
        process.off('SIGINT', cancel);
        process.off('SIGTERM', cancel);
        if (log) {
            await new Promise<void>((accept) => {
                log.end(accept);
            });
        }
    }
}

function readIteration(path: string) {
    const result = parseJSON(readFileSync(path, 'utf8'));
    if (!isRecord(result) || result.status !== 'SUCCESS' || !Array.isArray(result.iterations) || result.iterations.length !== 1) {
        throw new Error(`Invalid or failed Flashlight result: ${path}`);
    }
    const iteration: unknown = result.iterations.at(0);
    if (!isRecord(iteration) || iteration.status !== 'SUCCESS' || !Array.isArray(iteration.measures) || iteration.measures.length < 10) {
        throw new Error(`Missing successful profiler samples: ${path}`);
    }
    return iteration;
}

async function startGestureBridge({device, output, env}: {device: string; output: string; env: NodeJS.ProcessEnv}) {
    const adb = (...args: string[]) => execFileSync('adb', ['-s', device, ...args], {encoding: 'utf8', env});
    const sizeText = adb('shell', 'wm', 'size');
    const densityText = adb('shell', 'wm', 'density');
    const size = [...sizeText.matchAll(/(?:Physical|Override) size: (\d+)x(\d+)/g)].at(-1);
    const dpi = [...densityText.matchAll(/(?:Physical|Override) density: (\d+)/g)].at(-1);
    if (!size || !dpi) {
        throw new Error('Cannot determine Android screen size/density');
    }
    const screen = {
        width: Number(size[1]),
        height: Number(size[2]),
        density: Number(dpi[1]) / 160,
    };
    const plans = {
        fast: gesturePlan({flow: 'fast', ...screen}),
        slow: gesturePlan({flow: 'slow', ...screen}),
    };
    save(join(output, 'gesture-plans.json'), {
        screen,
        settings: gestureSettings,
        plans,
    });

    const sdk = env.ANDROID_SDK_ROOT ?? env.ANDROID_HOME ?? join(homedir(), 'Library/Android/sdk');
    const helperDir = join(output, 'native-helper');
    mkdirSync(helperDir, {recursive: true});
    const classes = join(helperDir, 'classes');
    mkdirSync(classes, {recursive: true});
    const androidJar = join(sdk, 'platforms/android-36/android.jar');
    await run('javac', ['--release', '17', '-cp', androidJar, '-d', classes, join(directory, 'AndroidReleasedPans.java')], {env});
    await run(
        join(sdk, 'build-tools/36.0.0/d8'),
        [
            '--lib',
            androidJar,
            '--min-api',
            '24',
            '--output',
            helperDir,
            ...readdirSync(classes)
                .filter((file) => file.endsWith('.class'))
                .map((file) => join(classes, file)),
        ],
        {env},
    );
    const jar = join(helperDir, 'released-pans.jar');
    await run('jar', ['cf', jar, '-C', helperDir, 'classes.dex'], {env});
    const token = randomBytes(16).toString('hex');
    const deviceJar = `/data/local/tmp/expensify-released-pans-${token}.jar`;
    adb('push', jar, deviceJar);
    const nativeArgs = (argument: string) => ['-s', device, 'shell', `CLASSPATH=${deviceJar}`, 'app_process', '/system/bin', 'AndroidReleasedPans', argument];
    await run('adb', nativeArgs('--probe'), {env});

    let busy = false;
    const server = createServer((request, response) => {
        (async () => {
            if (request.method !== 'POST' || request.url !== `/${token}`) {
                response.writeHead(404).end();
                return;
            }
            if (busy) {
                response.writeHead(409).end('A gesture sequence is already running');
                return;
            }
            busy = true;
            try {
                let body = '';
                for await (const chunk of request) {
                    body += String(chunk);
                    if (body.length > 4096) {
                        throw new Error('Gesture request too large');
                    }
                }
                const data = parseJSON(body);
                if (!isRecord(data) || (data.flow !== 'fast' && data.flow !== 'slow') || typeof data.label !== 'string' || !/^[a-z0-9-]{1,80}$/.test(data.label)) {
                    throw new Error('Expected fast/slow flow and a safe run label');
                }
                const plan = plans[data.flow];
                const encoded = Buffer.from(JSON.stringify(plan)).toString('base64');
                const stdout = await run('adb', nativeArgs(encoded), {env});
                const result = parseJSON(stdout.trim());
                if (!isRecord(result) || result.status !== 'SUCCESS' || result.panCount !== 30 || !Array.isArray(result.pans)) {
                    throw new Error(`Native gesture helper failed: ${stdout}`);
                }
                save(join(output, `${data.label}-gestures.json`), {plan, ...result});
                response.setHeader('Content-Type', 'application/json');
                response.writeHead(200).end(JSON.stringify(result));
            } catch (error) {
                response.writeHead(500).end(String(error));
            } finally {
                busy = false;
            }
        })().catch((error: unknown) => {
            response.destroy(error instanceof Error ? error : new Error(String(error)));
        });
    });
    await new Promise<void>((accept, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', accept);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Missing gesture bridge port');
    }
    return {
        url: `http://127.0.0.1:${address.port}/${token}`,
        close: async () => {
            await new Promise<void>((accept) => {
                server.close(() => accept());
            });
            try {
                adb('shell', 'rm', '-f', deviceJar);
            } catch (error) {
                // A disconnected phone must not hide the original test failure.
                console.warn(`Could not remove temporary device helper ${deviceJar}: ${String(error)}`);
            }
        },
    };
}

const {values} = parseArgs({
    options: {
        mode: {type: 'string', default: 'flow'},
        device: {type: 'string'},
        app: {type: 'string', default: 'com.chrispader.expensify.legendlist'},
        flow: {type: 'string', default: 'fast'},
        output: {type: 'string'},
        iterations: {type: 'string', default: '5'},
        // eslint-disable-next-line @typescript-eslint/naming-convention -- Public kebab-case CLI option.
        'skip-prepare': {type: 'boolean', default: false},
        evidence: {type: 'boolean', default: false},
    },
});
const device = values.device;
if (!device || !values.output) {
    throw new Error('--device and --output are required');
}
if (values.mode !== 'flow' && values.mode !== 'suite') {
    throw new Error('--mode must be flow or suite');
}
if (values.flow !== 'fast' && values.flow !== 'slow') {
    throw new Error('--flow must be fast or slow');
}
const iterations = Number(values.iterations);
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 50) {
    throw new Error('--iterations must be 1..50');
}
const output = resolve(values.output);
mkdirSync(output, {recursive: true});
const env: NodeJS.ProcessEnv = {...process.env, ANDROID_SERIAL: device};
const existingURL = env.BENCHMARK_GESTURE_URL;
const bridge = existingURL ? undefined : await startGestureBridge({device, output, env});
const gestureURL = existingURL ?? bridge?.url;
if (!gestureURL) {
    throw new Error('Gesture bridge did not start');
}

const maestroArgs = ({flowFile, app, artifacts, label}: {flowFile: string; app: string; artifacts: string; label: string}) => [
    'test',
    '--device',
    device,
    '-e',
    `APP_ID=${app}`,
    '-e',
    `GESTURE_URL=${gestureURL}`,
    '-e',
    `RUN_LABEL=${label}`,
    '-e',
    `CAPTURE_EVIDENCE=${String(Number(values.evidence))}`,
    join(directory, flowFile),
    '--test-output-dir',
    artifacts,
];
const flowFile = (flow: ScrollFlow) => (flow === 'fast' ? 'warm-fast-bursts.maestro.yaml' : 'warm-slow-scrolls.maestro.yaml');

try {
    if (values.mode === 'flow') {
        const app = values.app;
        if (!/^com\.chrispader\.expensify\.(flashlist|legendlist)$/.test(app)) {
            throw new Error('Expected a benchmark variant application ID');
        }
        const label = basename(output)
            .replaceAll(/[^a-z0-9-]/gi, '-')
            .toLowerCase();
        if (!values['skip-prepare']) {
            await run(
                'maestro',
                maestroArgs({
                    flowFile: 'warm-fast-scroll.prepare-inbox.maestro.yaml',
                    app,
                    label,
                    artifacts: join(output, 'prepare'),
                }),
                {env, logPath: join(output, 'prepare.log')},
            );
        }
        await run(
            'maestro',
            maestroArgs({
                flowFile: flowFile(values.flow),
                app,
                label,
                artifacts: join(output, 'maestro'),
            }),
            {env, logPath: join(output, 'flow.log')},
        );
    } else {
        const adb = (...args: string[]) => execFileSync('adb', ['-s', device, ...args], {encoding: 'utf8', env});
        const metadataPath = join(output, 'metadata.json');
        if (!existsSync(metadataPath)) {
            save(metadataPath, {
                startedAt: new Date().toISOString(),
                device,
                iterations,
                model: adb('shell', 'getprop', 'ro.product.model').trim(),
                batteryAtStart: adb('shell', 'dumpsys', 'battery'),
                appVersions: Object.fromEntries(
                    ['flashlist', 'legendlist'].map((variant) => [
                        variant,
                        adb('shell', 'dumpsys', 'package', `com.chrispader.expensify.${variant}`)
                            .split('\n')
                            .filter((line) => /versionName=|versionCode=|lastUpdateTime=|flags=\[/.test(line))
                            .map((line) => line.trim()),
                    ]),
                ),
                sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], {
                    cwd: root,
                    encoding: 'utf8',
                }).trim(),
                note: 'LegendList rebuilt for this batch. FlashList uses its existing release build. App version differences confound a list-library-only comparison. Maestro startup/assertion overhead remains inside the Flashlight interval.',
            });
        }
        const flows: ScrollFlow[] = ['fast', 'slow'];
        for (const flow of flows) {
            const flowOutput = join(output, flow);
            const raw = join(flowOutput, 'raw');
            mkdirSync(raw, {recursive: true});
            for (let iteration = 1; iteration <= iterations; iteration++) {
                const variants = iteration % 2 === 1 ? ['flashlist', 'legendlist'] : ['legendlist', 'flashlist'];
                for (const variant of variants) {
                    const label = `${flow}-${variant}-${iteration}`;
                    const resultPath = join(raw, `${variant}-${iteration}.json`);
                    if (existsSync(resultPath)) {
                        readIteration(resultPath);
                        continue;
                    }
                    const app = `com.chrispader.expensify.${variant}`;
                    const sampleOutput = join(flowOutput, label);
                    mkdirSync(sampleOutput, {recursive: true});
                    const cooldownReadings = [];
                    for (let attempt = 0; ; attempt++) {
                        const thermal = adb('shell', 'dumpsys', 'thermalservice');
                        const match = thermal.match(/Thermal Status: (\d+)/);
                        if (!match) {
                            throw new Error('Cannot read Android thermal status; check the device before measuring');
                        }
                        const status = Number(match[1]);
                        cooldownReadings.push({time: new Date().toISOString(), status, thermal});
                        save(join(sampleOutput, 'thermal-before.json'), cooldownReadings);
                        // Android status 2 is moderate throttling. Wait outside
                        // Flashlight's measured interval until it drops below 2.
                        if (status < 2) {
                            break;
                        }
                        if (attempt >= 13) {
                            throw new Error('Phone remains thermally throttled after 10 minutes; cool it before resuming');
                        }
                        console.log(`COOLING before ${label}: thermal status ${status}; checking again in 45s`);
                        await new Promise((accept) => {
                            setTimeout(accept, 45_000);
                        });
                    }
                    save(join(sampleOutput, 'battery-before.json'), {
                        time: new Date().toISOString(),
                        output: adb('shell', 'dumpsys', 'battery'),
                    });
                    const before = maestroArgs({
                        flowFile: 'warm-fast-scroll.prepare-inbox.maestro.yaml',
                        app,
                        label,
                        artifacts: join(sampleOutput, 'prepare'),
                    });
                    const test = ['node', fileURLToPath(import.meta.url), '--mode', 'flow', '--device', device, '--app', app, '--flow', flow, '--output', sampleOutput, '--skip-prepare'];
                    console.log(`\nSTART ${label} ${new Date().toISOString()}`);
                    await run(
                        'flashlight',
                        [
                            'test',
                            '--bundleId',
                            app,
                            '--iterationCount',
                            '1',
                            '--maxRetries',
                            '0',
                            '--resultsTitle',
                            `${variant === 'flashlist' ? 'FlashList' : 'LegendList'} ${flow} scrolling`,
                            '--beforeEachCommand',
                            ['maestro', ...before].map(quote).join(' '),
                            '--testCommand',
                            test.map(quote).join(' '),
                            '--resultsFilePath',
                            resultPath,
                        ],
                        {
                            env: {...env, BENCHMARK_GESTURE_URL: gestureURL},
                            logPath: join(raw, `${variant}-${iteration}.log`),
                        },
                    );
                    readIteration(resultPath);
                    save(join(sampleOutput, 'battery-after.json'), {
                        time: new Date().toISOString(),
                        output: adb('shell', 'dumpsys', 'battery'),
                    });
                    save(join(sampleOutput, 'thermal-after.json'), {
                        time: new Date().toISOString(),
                        output: adb('shell', 'dumpsys', 'thermalservice'),
                    });
                    console.log(`COMPLETE ${label}`);
                }
            }
            for (const variant of ['flashlist', 'legendlist']) {
                save(join(flowOutput, `${variant}-${iterations}-runs.json`), {
                    name: `${variant === 'flashlist' ? 'FlashList' : 'LegendList'} ${flow} scrolling (${iterations} runs)`,
                    status: 'SUCCESS',
                    iterations: Array.from({length: iterations}, (_, index) => readIteration(join(raw, `${variant}-${index + 1}.json`))),
                });
            }
            const reportOutput = join(flowOutput, 'report');
            mkdirSync(reportOutput, {recursive: true});
            await run(
                'flashlight',
                ['report', join(flowOutput, `flashlist-${iterations}-runs.json`), join(flowOutput, `legendlist-${iterations}-runs.json`), '--skip', '2000', '--output-dir', reportOutput],
                {env, logPath: join(flowOutput, 'report.log')},
            );
        }
        save(join(output, 'completion.json'), {
            finishedAt: new Date().toISOString(),
            successfulRuns: iterations * 4,
        });
        console.log(`ALL COMPLETE: ${output}`);
    }
} finally {
    await bridge?.close();
}
