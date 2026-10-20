/** In-app release notes, newest first. Keep in step with CHANGELOG.md at the repo root. */
export interface Release {
  version: string;
  date: string;
  title: string;
  items: string[];
}

export const RELEASES: Release[] = [
  {
    version: "0.16.0",
    date: "2026-10-20",
    title: "Two-factor for everyone, Activity log, move bases.",
    items: [
      "Two-factor sign-in is required for every account: you’re asked to set it up the next time you sign in.",
      "You stay signed in for 30 days without activity; each visit restarts the 30 days.",
      "Only Creators and Owners create or change share links, and “Allow copying data” is enforced on the shared page.",
      "Owners and Creators can always edit a field, even one set to “Nobody”.",
      "Automations show who they run as, and Creators can change it.",
      "Members & access → Activity shows who did what.",
      "Move a base to another workspace from its menu on Home.",
      "Only Owners, Admins and Workspace Owners see other members’ email addresses.",
    ],
  },
  {
    version: "0.15.0",
    date: "2026-10-20",
    title: "Owners, Admins and Members.",
    items: [
      "Three account types: Owner, Admin and Member. An organization can have several Owners, and ownership can be transferred.",
      "Admins invite and manage Members, approve their devices, create workspaces and API tokens, and change security settings. They open only what an Owner gives them.",
      "Only Owners make someone an Admin or Owner, including straight from an invitation.",
      "Workspaces can have more than one Workspace Owner.",
      "Share on Home now uses the same invite form as Members & access: whole workspace or selected bases.",
    ],
  },
  {
    version: "0.14.0",
    date: "2026-10-19",
    title: "Accounts by invitation; Owners and Admins run workspaces.",
    items: [
      "New accounts need an invitation, or an email address at a domain your organization allows (Members & access → Security).",
      "Nobody gets a separate organization of their own when they sign up.",
      "Only Owners and Admins create workspaces and bases, duplicate bases and export data.",
      "Owners and Admins of several organizations choose which one a new workspace belongs to.",
      "The workspace contacts directory is only for people with a role on that workspace.",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-10-15",
    title: "Show your password while typing it.",
    items: [
      "Password fields (sign in, sign up, change password) have an eye button to show or hide the password.",
      "Browsers now remember the API’s cross-origin check (CORS preflight) for 2 hours instead of repeating it.",
    ],
  },
  {
    version: "0.12.1",
    date: "2026-10-15",
    title: "Faster syncs when many values don’t fit.",
    items: ["Syncs with lots of invalid values (for example phone numbers) now run at normal speed."],
  },
  {
    version: "0.12.0",
    date: "2026-10-15",
    title: "Reliable syncs you can stop, clearer imports, device and history logs.",
    items: [
      "A value that doesn’t fit (like an invalid phone number) no longer fails a sync: everything else syncs, and you review the rest.",
      "Review skipped values by field: keep that field as text, or leave them empty.",
      "Sync now runs in the background with progress; Stop, Pause and Resume are on the sync bar.",
      "Synced tables refresh on their own again.",
      "Import: Stop works instantly, and invalid entries are listed so you can fix them, import them empty, or skip them.",
      "Members & access → Devices is grouped per person, with active and ended sessions and every approval and revocation.",
      "Record history can be grouped by person or by field.",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-10-15",
    title: "Access per base, notifications everywhere, smoother imports.",
    items: [
      "Members & access: a base’s own role overrides the workspace role, including “No access to this base”.",
      "Invite someone to several selected bases in one go; they don’t see the other bases.",
      "Tick several rows in a member’s access table to change them together.",
      "The notification bell is on the Home page too, and can show desktop notifications.",
      "Help → Back takes you back to where you were, not through the topics you read.",
      "Import: columns named like existing fields (Notes, Attachments) are highlighted, and you choose for each: use the existing field, rename it, replace the existing field, or skip it.",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-10-14",
    title: "Attachment cells expand, time zones, and device approval alerts.",
    items: [
      "Select an attachment cell and click ⤢ to see all files large: open, download, delete, reorder or add more.",
      "Download now saves the file to your computer.",
      "Owners get a notification when someone needs a new device approved.",
      "Date fields can use one time zone for everyone (US, Europe, GMT and more) and show it, e.g. EDT.",
      "Last modified time fills in for records edited before the field was added.",
      "Filter values can be changed directly: click anywhere in the value to open the list.",
    ],
  },
  {
    version: "0.9.1",
    date: "2026-10-14",
    title: "Automations run again.",
    items: [
      "Fixed automations not running on their own: record, schedule, webhook and button triggers fire again.",
      "Switching to Data and back keeps you on the same automation, tab (Edit or Run history) and step.",
      "Conditions in the automation panel are readable: nested groups put the field, operator and value on separate lines.",
      "Scripts accept Airtable-style code: base.getTable(), selectRecordsAsync(), deleteRecordAsync() and more.",
      "Scripts can take input variables, read with input.config().",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-10-13",
    title: "Field permissions, better search, and the new activity and filter menus.",
    items: [
      "Field header menu → Edit field permissions: choose who can edit a field’s values (Editors and up, Creators and up, Specific users, or Nobody). Everyone still sees the values.",
      "Search now finds columns by name: matching headers are highlighted and the grid scrolls to them.",
      "Fixed being sent back to the sign-in page while searching a large table.",
      "Search waits until you stop typing, so big tables stay fast.",
      "Record activity: filter by all activity, revision history or comments, and follow a record’s comments with the bell.",
      "Filters: each condition fits on one row, with Add condition group and Copy from another view.",
    ],
  },
  {
    version: "0.8.2",
    date: "2026-10-13",
    title: "Sign-in works again.",
    items: [
      "Fixed “The server is unavailable right now” when signing in or creating an account.",
      "Database updates now install automatically when the server starts, so a release can't run without them.",
    ],
  },
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
