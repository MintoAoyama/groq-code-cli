import * as fs from 'fs';

export interface BuildInfo {
  repository?: string;
  commit?: string;
  dirty?: boolean;
}

export function formatVersion(version: string, buildInfo: BuildInfo): string {
  if (!buildInfo.repository || !buildInfo.commit) {
    return version;
  }
  const commit = buildInfo.dirty ? `${buildInfo.commit}-dirty` : buildInfo.commit;
  return `${version} (${buildInfo.repository}@${commit})`;
}

function readJson<T>(url: URL): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(url, 'utf-8')) as T;
  } catch {
    return undefined;
  }
}

export function getVersion(): string {
  const pkg = readJson<{ version: string }>(new URL('../../package.json', import.meta.url));
  // build-info.json is written next to the compiled output by scripts/write-build-info.mjs.
  const buildInfo = readJson<BuildInfo>(new URL('../build-info.json', import.meta.url)) ?? {};
  return formatVersion(pkg?.version ?? 'unknown', buildInfo);
}
