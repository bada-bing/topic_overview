// Something a discussion depends on outside its source, named after the
// system that is asked about it. A merge request is read off the page's
// Links; the others are added by the agent.
export const INTEGRATION_KINDS = ["merge-request", "local", "cluster", "jenkins", "browser"] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

export interface Integration {
  id: string;
  kind: IntegrationKind;
  reference: string; // what the system knows it by, such as project:process
  label?: string;
  detail?: string; // what the page says of it, such as what a merge request does
  tab?: Tab; // a browser page's tab, once the view opened it
}

// The tab the view opened a browser page in, and how to reach it over the
// Chrome DevTools Protocol: the browser's endpoint, and the tab's own
// WebSocket, which a client attaches to in order to control the page.
export interface Tab {
  id: string;
  endpoint: string; // such as http://127.0.0.1:9223
  webSocket: string; // such as ws://127.0.0.1:9223/devtools/page/<id>
}
