import { log } from '../../../shared/utils/logger.js';

// Article/RSS/Finnhub adapters are deprecated for macro cognition.
// This module intentionally does not start any article ingestion daemons.

export async function startAdapters() {
  log({ stage: 'NEWS_ADAPTERS_DEPRECATED', message: 'Article/RSS ingestion adapters are deprecated and will not be started' });
}

export async function stopAdapters() {
  log({ stage: 'NEWS_ADAPTERS_DEPRECATED_STOP', message: 'No adapters to stop (deprecated)' });
}

export default { startAdapters, stopAdapters };
