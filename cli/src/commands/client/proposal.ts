import { Command } from "commander";
import {
  addCommonClientOptions,
  formatInlineRecord,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface ProposalCreateOptions extends BaseClientOptions {
  companyId?: string;
  title: string;
  description: string;
  category?: string;
  priority?: string;
  proposedByAgentId?: string;
}

interface FeatureProposal {
  id: string;
  companyId: string;
  proposedByAgentId: string | null;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdIssueId: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export function registerProposalCommands(program: Command): void {
  const proposal = program.command("proposal").description("Feature proposal operations");

  addCommonClientOptions(
    proposal
      .command("create")
      .description("Publish a feature proposal for board review")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .requiredOption("--title <title>", "Proposal title")
      .requiredOption("--description <text>", "Proposal description")
      .option(
        "--category <category>",
        "Category: ui, backend, infra, ux, other (default: other)",
      )
      .option(
        "--priority <priority>",
        "Priority: high, normal, low (default: normal)",
      )
      .option("--proposed-by-agent-id <id>", "Agent ID submitting this proposal")
      .action(async (opts: ProposalCreateOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const payload = {
            title: opts.title,
            description: opts.description,
            category: opts.category ?? "other",
            priority: opts.priority ?? "normal",
            proposedByAgentId: opts.proposedByAgentId ?? null,
          };
          const created = await ctx.api.post<FeatureProposal>(
            `/api/companies/${ctx.companyId}/feature-proposals`,
            payload,
          );
          if (ctx.json) {
            printOutput(created, { json: true });
            return;
          }
          console.log(
            formatInlineRecord({
              id: created.id,
              title: created.title,
              category: created.category,
              priority: created.priority,
              status: created.status,
            }),
          );
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );
}
