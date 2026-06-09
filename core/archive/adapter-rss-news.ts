// rss-parser has transitive typing gaps depending on xml2js; keep adapter isolated from TS typechecking.
// @ts-ignore
import Parser from "rss-parser";
import { ingestionController } from "./ingestion-controller.js";
import { log } from "../../../shared/utils/logger.js";

const RSS_FEEDS = [
    "https://www.dailyfx.com/feeds/market-news",
    "https://www.fxstreet.com/rss/news",
];

export class RSSNewsAdapter {
    private intervalMs: number;
    private timeoutMs: number;
    private timer?: NodeJS.Timeout;
    private stopped = false;

    private parser = new Parser();

    constructor(opts?: { intervalMs?: number; timeoutMs?: number }) {
        this.intervalMs = opts?.intervalMs ?? 5 * 60 * 1000;
        this.timeoutMs = opts?.timeoutMs ?? 15 * 1000;
    }

    start() {
        this.stopped = false;
        this.poll();
    }

    stop() {
        this.stopped = true;
        if (this.timer) clearTimeout(this.timer);
    }

    private async poll() {
        if (this.stopped) return;

        log({
            stage: "RSS_FETCH",
            message: "Polling RSS feeds",
            data: { feeds: RSS_FEEDS, timestamp: new Date().toISOString() }
        });

        let usedFeedUrl: string | null = null;
        let feed: any = null;

        // rss-parser does the fetching internally; try feeds sequentially until one succeeds
        for (const feedUrl of RSS_FEEDS) {
            try {
                const controller =
                    new AbortController();

                const timeout =
                    setTimeout(
                        () => controller.abort(),
                        10000
                    );

                const response = await fetch(
                    feedUrl,
                    {
                        signal: controller.signal,
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 RSSBot"
                        }
                    }
                );



                clearTimeout(timeout);

                const xml = await response.text();

                log({
                    stage: "RSS_FETCH_SUCCESS",
                    message: "RSS fetch succeeded",
                    data: {
                        feedUrl,
                        status: response.status
                    }
                });

                log({
                    stage: "RSS_PARSE",
                    message: "Parsing RSS XML",
                    data: {
                        feedUrl,
                        length: xml.length
                    }
                });

                try {

                    feed = await this.parser.parseString(xml);

                } catch (err: any) {

                    log({
                        stage: "RSS_PARSE_ERROR",
                        level: "ERROR",
                        message: "rss-parser parseString failed",
                        data: {
                            error: err?.message,
                            stack: err?.stack,
                            feedUrl,
                            xmlPreview: xml.slice(0, 500)
                        }
                    });

                    continue;
                }

                usedFeedUrl = feedUrl;

                break;
            } catch (err: any) {
                log({
                    stage: "RSS_FETCH_ERROR",
                    level: "ERROR",
                    message: "RSS fetch failed",
                    data: {
                        feedUrl,
                        error: err?.message
                    }
                });

                usedFeedUrl = null;
                feed = null;
            }
        }

        if (!usedFeedUrl || !feed) {
            this.timer = setTimeout(() => this.poll(), this.intervalMs);
            return;
        }

        try {

            const rawItems =
                Array.isArray(feed?.items)
                    ? feed.items
                    : [];

            log({
                stage: "RSS_RAW_ITEMS",
                message: "RSS raw items received",
                data: {
                    count: rawItems.length,
                    feedTitle: feed?.title
                }
            });

            const items = rawItems.map((item: any) => ({
                title:
                    item?.title || '',

                description:
                    item?.contentSnippet ||
                    item?.content ||
                    '',

                pubDate:
                    item?.pubDate ||
                    item?.isoDate ||
                    '',

                link:
                    item?.link || '',

                category:
                    item?.categories?.[0] || '',

                source:
                    usedFeedUrl
            }));

            // Required observability after parser mapping
            log({
                stage: "RSS_ITEMS_PARSED",
                message: "RSS items extracted",
                data: {
                    count: items.length,
                    sample: items[0]?.title
                }
            });

            const payloads: Array<{
                id: string;
                title: string;
                description: string;
                timestamp: string;
                source: string;
                url: string;
            }> = [];

            for (const it of items) {
                const normalized = this.normalizeRSSItem(it);
                if (!normalized) continue;
                payloads.push(normalized);
            }

            if (payloads.length) {
                await ingestionController
                    .ingest("rss-news", "rss-news", payloads)
                    .catch((err: any) => {
                        log({
                            stage: "NEWS_INGESTION",
                            message: "RSS events ingestion failed",
                            level: "ERROR",
                            data: { error: err?.message }
                        });
                    });

                log({
                    stage: "NEWS_INGESTION",
                    message: "RSS events ingested",
                    data: { count: payloads.length }
                });
            }
        } catch (err: any) {
            log({
                stage: "RSS_RUNTIME_ERROR",
                level: "ERROR",
                message: "RSS runtime failed",
                data: {
                    error: err?.message
                }
            });
        }

        this.timer = setTimeout(() => this.poll(), this.intervalMs);
    }

    /**
     * Canonical event shape:
     * { id, title, description, timestamp, source, url }
     */
    private normalizeRSSItem(item: any) {
        const title = (item?.title ?? "").trim();
        if (!title) return null;

        const url = (item?.link ?? "").trim();
        const rawTs = (item?.pubDate ?? "").trim();

        let timestamp: string;

        if (!rawTs || Number.isNaN(new Date(rawTs).getTime())) {
            timestamp = new Date().toISOString();
        } else {
            timestamp = new Date(rawTs).toISOString();
        }

        console.log("NORMALIZED ITEM", {
            title,
            rawTs,
            timestamp
        });

        const id = url || `${title}_${timestamp}`;
        const description = (item?.description ?? "").trim();

        return {
            id,
            title,
            description,
            timestamp,
            source: item?.source ?? "rss",
            url
        };
    }
}

export default RSSNewsAdapter;
