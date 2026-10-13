/** In-app release notes, newest first. Keep in step with CHANGELOG.md at the repo root. */
export interface Release {
  version: string;
  date: string;
  title: string;
  items: string[];
}

export const RELEASES: Release[] = [
  {
    version: "0.8.1",
    date: "2026-10-13",
    title: "You stay signed in.",
    items: [
      "Sessions no longer expire: you stay signed in until you sign out, change your password, or an admin removes you.",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-10-13",
    title: "Dashboards with date trends, sign-in protection, and links that point to the exact table and record.",
    items: [
      "Interfaces: bar, horizontal bar, line, area, pie and donut charts with hover details, value labels, several values per chart and negative numbers.",
      "Interfaces: group date axes by day, week, month, quarter or year; empty periods show as zero.",
      "Interfaces: new Date filter element (today, last 7/30/90 days, this/last month, this year, custom range) that every element on the page follows.",
      "Dates are read in your own time zone, which TableOS now picks up from your browser.",
      "Wrong passwords: a warning with attempts left from the 3rd try, a 15-minute lock with a countdown after the 5th, for accounts and password-protected shared links. The owner’s account is exempt.",
      "Every wrong password alerts the organization owner straight away with the email, IP address and browser.",
      "The address bar now always shows the base, table and view IDs, plus the record ID when a record is open.",
      "Import into an existing table: unmatched columns default to New field, with Import all and Don’t import any buttons. New number fields keep the file’s decimal places.",
      "A ☰ button in the view toolbar hides and shows the views sidebar.",
      "The grid header has a bottom border again.",
      "Version number in Help and the account menu, a /v1/version API endpoint and these release notes.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-10-12",
    title: "Attachments in cloud storage, Record ID as the primary field, and automation improvements.",
    items: [
      "Attachments upload to Google Cloud Storage through the API and open in an in-app viewer.",
      "New tables start with Record ID as the primary field (no default Name/Status/Assignee); imports keep it, and the 2,000-record cap is gone.",
      "Column menu: Set as primary field.",
      "Last modified time can watch all editable fields or chosen fields.",
      "Automation tests use the record selected in the grid, accept a pasted record ID or link, and show readable record labels.",
      "Script steps can insert values from earlier steps; the JavaScript sandbox was extended.",
      "The database pool no longer crashes when a checked-out connection drops.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-10-08",
    title: "Owner-controlled access and the Help centre.",
    items: [
      "Only the owner invites people and sets workspace or base roles, with access end dates, suspend and remove.",
      "Device approval for members, API access tokens, synced tables from other bases, HubSpot, Airtable, Gmail and Slack.",
      "Help & documentation centre.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-10-07",
    title: "Interfaces builder and Forms studio.",
    items: ["Interfaces builder, Forms studio, an always-on Record ID field and visible view creation."],
  },
  {
    version: "0.3.0",
    date: "2026-10-07",
    title: "Navigation and import polish.",
    items: ["Table-bar overflow menu, Record ID filters, import retries and TableOS branding."],
  },
  {
    version: "0.2.0",
    date: "2026-10-07",
    title: "Fix pass across the whole product.",
    items: [
      "Query engine, sharing, public app, attachments, import/export, search, notifications, automations, auth and MFA, permissions.",
      "Grid editing, calendar spanning bars, 10k-row scrolling, record revision history.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-10-06",
    title: "Baseline.",
    items: ["The starting snapshot of TableOS."],
  },
];
