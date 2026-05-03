export const type = "kimi_api";
export const label = "Kimi (API)";
export const DEFAULT_KIMI_API_MODEL = "kimi-k2";

export const models = [
  { id: DEFAULT_KIMI_API_MODEL, label: DEFAULT_KIMI_API_MODEL },
  { id: "kimi-k2-coder", label: "kimi-k2-coder" },
  { id: "kimi-k2-mini", label: "kimi-k2-mini" },
  { id: "kimi-k1.6", label: "kimi-k1.6" },
];

export const agentConfigurationDoc = `# kimi_api agent configuration

Adapter: kimi_api

Core fields:
- model (string, optional): Kimi model id, defaults to "kimi-k2"
- baseUrl (string, optional): Moonshot API base URL, defaults to "https://api.moonshot.cn/v1"
- temperature (number, optional): sampling temperature (0-2)
- maxTokens (number, optional): maximum tokens to generate
- promptTemplate (string, optional): run prompt template
- timeoutSec (number, optional): request timeout in seconds
- env (object, optional): KEY=VALUE environment variables. Must include MOONSHOT_API_KEY or KIMI_API_KEY.

Operational fields:
- timeoutSec (number, optional): run timeout in seconds

Notes:
- Calls Moonshot's OpenAI-compatible API directly via HTTP.
- Requires MOONSHOT_API_KEY or KIMI_API_KEY in adapter env or shell environment.
- Streaming responses are supported.
`;
