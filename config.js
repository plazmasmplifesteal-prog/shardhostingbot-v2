import 'dotenv/config';

const splitIds = (value = '') => value.split(',').map(v => v.trim()).filter(Boolean);
const bool = (value, fallback = false) => value == null ? fallback : String(value).toLowerCase() === 'true';

export const config = {
  token: process.env.DISCORD_TOKEN ?? '',
  clientId: process.env.CLIENT_ID ?? '',
  guildId: process.env.GUILD_ID ?? '',
  launchStatus: process.env.LAUNCH_STATUS ?? 'prelaunch',
  maintenance: bool(process.env.MAINTENANCE),
  maintenanceMessage: process.env.MAINTENANCE_MESSAGE ?? 'No maintenance announced.',
  websiteUrl: process.env.WEBSITE_URL ?? '',
  panelUrl: process.env.PANEL_URL ?? '',
  billingUrl: process.env.BILLING_URL ?? '',
  supportEmail: process.env.SUPPORT_EMAIL ?? '',
  staffRoleIds: splitIds(process.env.STAFF_ROLE_IDS),
  ticketCategoryId: process.env.TICKET_CATEGORY_ID ?? '',
  closedTicketCategoryId: process.env.CLOSED_TICKET_CATEGORY_ID ?? '',
  ticketLogChannelId: process.env.TICKET_LOG_CHANNEL_ID ?? '',
  modLogChannelId: process.env.MOD_LOG_CHANNEL_ID ?? '',
  announcementChannelId: process.env.ANNOUNCEMENT_CHANNEL_ID ?? '',
  dataPath: process.env.DATA_PATH ?? 'data/tickets.json'
};

export const plans = [
  { name: 'Starter', ram: '2 GB', price: '€3.99/month', for: 'Small vanilla servers / friends' },
  { name: 'Basic', ram: '4 GB', price: '€6.99/month', for: 'Small SMPs / plugins' },
  { name: 'Pro', ram: '6 GB', price: '€9.99/month', for: 'Growing communities / heavier plugins' },
  { name: 'Extreme', ram: '8 GB', price: '€12.99/month', for: 'Large SMPs / demanding workloads' }
];
