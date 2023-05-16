import { Resolver } from "node:dns/promises";
import { request } from "undici";
import { updateStatus } from "./cli";
import { blue, brandColor, dim } from "./colors";
import { spinner } from "./interactive";

const TIMEOUT = 1000 * 60 * 5;
const POLL_INTERVAL = 1000;

export const poll = async (url: string): Promise<boolean> => {
	const start = Date.now();
	const domain = new URL(url).host;
	const s = spinner();

	while (Date.now() - start < TIMEOUT) {
		s.start("Waiting for deployment to become available");
		if (await dnsLookup(domain)) {
			updateStatus("DNS registered");
			break;
		}
		await sleep(POLL_INTERVAL);
	}

	while (Date.now() - start < TIMEOUT) {
		updateStatus("Waiting for website to be available at " + url);
		const { statusCode } = await request(url, {
			reset: true,
			headers: { "Cache-Control": "no-cache" },
		});
		if (statusCode === 200) {
			s.stop(`${brandColor("deployment")} ${dim("is ready at:")} ${blue(url)}`);
			return true;
		}
		await sleep(POLL_INTERVAL);
	}

	s.stop(`${brandColor("deployment")} timed out waiting for ${url}.`);
	return false;
};

async function dnsLookup(domain: string): Promise<boolean> {
	try {
		const resolver = new Resolver({ timeout: TIMEOUT, tries: 1 });
		resolver.setServers([
			"1.1.1.1",
			"1.0.0.1",
			"2606:4700:4700::1111",
			"2606:4700:4700::1001",
		]);
		return (await resolver.resolve4(domain)).length > 0;
	} catch (e) {
		return false;
	}
}

export const sleep = async (ms: number) => {
	return new Promise((res) => setTimeout(res, ms));
};
