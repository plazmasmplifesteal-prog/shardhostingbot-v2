import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from 'discord.js';

export const commandBuilders = [
  new SlashCommandBuilder().setName('help').setDescription('Show Shard Bot commands'),
  new SlashCommandBuilder().setName('plans').setDescription('Show Shard Hosting plans'),
  new SlashCommandBuilder().setName('website').setDescription('Get the Shard Hosting website'),
  new SlashCommandBuilder().setName('panel').setDescription('Get the game panel link'),
  new SlashCommandBuilder().setName('billing').setDescription('Get the billing panel link'),
  new SlashCommandBuilder().setName('status').setDescription('Show Shard Hosting status'),
  new SlashCommandBuilder().setName('support').setDescription('Open a support ticket'),
  new SlashCommandBuilder().setName('ticket-panel').setDescription('Post the public Shard Hosting ticket panel').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('support-panel').setDescription('Post the public Shard Hosting ticket panel').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('ticket-role').setDescription('Set the role pinged for a ticket category').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('category').setDescription('Ticket category').setRequired(true).addChoices(
      { name: 'Support', value: 'support' },
      { name: 'Billing', value: 'billing' },
      { name: 'Technical', value: 'technical' },
      { name: 'Migration', value: 'migration' }
    ))
    .addRoleOption(o => o.setName('role').setDescription('Role to ping').setRequired(true)),
  new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
  new SlashCommandBuilder()
    .setName('warn').setDescription('Warn a member')
    .addUserOption(o => o.setName('member').setDescription('Member to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder()
    .setName('timeout').setDescription('Timeout a member')
    .addUserOption(o => o.setName('member').setDescription('Member').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder()
    .setName('kick').setDescription('Kick a member')
    .addUserOption(o => o.setName('member').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder()
    .setName('ban').setDescription('Ban a member')
    .addUserOption(o => o.setName('member').setDescription('Member').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder()
    .setName('announce').setDescription('Post a Shard Hosting announcement')
    .addStringOption(o => o.setName('title').setDescription('Title').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Message').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
];
