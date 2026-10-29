/**
 * Forces a compaction and records the outcome, so a mock LLM run can prove
 * pi's real compaction path ran. Used by run-compaction.sh.
 */

import fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const logPath = process.env.MOCK_COMPACT_LOG ?? "/tmp/compact-probe.log";
const log = (message: string) => fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);

export default function (pi: ExtensionAPI) {
	pi.registerCommand("mock-compact", {
		description: "Force compaction (mock LLM probe)",
		handler: async (args, ctx) => {
			log(`command invoked args=${JSON.stringify(args)}`);
			ctx.compact({
				customInstructions: args.trim() || undefined,
				onComplete: (result) => log(`complete ${JSON.stringify(result).slice(0, 500)}`),
				onError: (error) => log(`error ${error instanceof Error ? error.message : String(error)}`),
			});
			log("compact() returned");
		},
	});
}
