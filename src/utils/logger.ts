import logger from 'debug';

const TAG = 'serverless-builder';

export const trace = logger(`${TAG}:trace`);
export const traceEnabled = logger.enabled(`${TAG}:trace`)

export const debug = logger(`${TAG}:debug`);
export const debugEnabled = logger.enabled(`${TAG}:debug`)

export const info = logger(`${TAG}:info`);
export const infoEnabled = logger.enabled(`${TAG}:info`)

export const error = logger(`${TAG}:error`);
export const errorEnabled = logger.enabled(`${TAG}:error`)