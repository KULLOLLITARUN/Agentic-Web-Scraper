// The product name, in one place. Markpull = mark (each record on the page)
// + pull (it out as data); the logo puts "Mark" on a highlighter stroke.
export const APP_NAME = { lead: 'Mark', rest: 'pull' };
export const BRAND = `${APP_NAME.lead}${APP_NAME.rest}`;
// Browser tab and search listings: the name plus what it is.
export const appTitle = () => `${BRAND} — AI web scraper`;
