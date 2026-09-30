import path from 'node:path';
import { SfProject, type Connection } from '@salesforce/core';
import { ApxError } from '../errors.js';
import { toDescribeView, type SObjectDescribeView } from './describe/describe.js';
import { MAX_CUSTOM_METADATA_RECORD_NAME_LENGTH } from './naming/naming.js';

export const DEFAULT_OUTPUT_PATH = 'generated-files';
export const DEFAULT_API_VERSION = '60.0';
export const ORDER_PATTERN = /^\d+(?:\.\d+)?$/;

export const resolveOutputBase = async (outputPath: string, projectRoot?: string): Promise<string> => {
  if (path.isAbsolute(outputPath)) return outputPath;
  return path.resolve(projectRoot ?? (await SfProject.resolveProjectPath()), outputPath);
};

export const resolveProjectApiVersion = async (projectRoot?: string): Promise<string | undefined> => {
  try {
    const project = await SfProject.resolve(projectRoot);
    const projectConfig = await (await project.retrieveSfProjectJson()).read();
    return projectConfig.sourceApiVersion;
  } catch (error) {
    if (error instanceof Error && error.name === 'InvalidProjectWorkspaceError') return undefined;
    throw error;
  }
};

export type ApiVersionOptions = { conn?: Pick<Connection, 'getApiVersion'>; explicit?: string; projectRoot?: string };

/** Preserve CLI precedence: explicit flag, connection version, then the default. */
export const resolveApiVersion = ({ conn, explicit }: ApiVersionOptions): Promise<string> =>
  Promise.resolve(explicit ? explicit : conn ? conn.getApiVersion() : DEFAULT_API_VERSION);

export const describeTarget = async (
  conn: Pick<Connection, 'describeSObject'>,
  sobject: string
): Promise<SObjectDescribeView> => {
  try {
    return toDescribeView(await conn.describeSObject(sobject));
  } catch (cause) {
    const details = cause as { name?: string; errorCode?: string; code?: string } | null;
    const notFound =
      details?.name === 'NOT_FOUND' || details?.errorCode === 'NOT_FOUND' || details?.code === 'NOT_FOUND';
    const message = cause instanceof Error ? cause.message : String(cause);
    if (notFound) throw new ApxError('sobject-not-found', message, { sobject });
    throw new ApxError('describe-failed', message, { sobject, cause });
  }
};

export const isValidOrderValue = (value: string): boolean => ORDER_PATTERN.test(value);
export const isWithinCustomMetadataNameLimit = (value: string): boolean =>
  value.length <= MAX_CUSTOM_METADATA_RECORD_NAME_LENGTH;
