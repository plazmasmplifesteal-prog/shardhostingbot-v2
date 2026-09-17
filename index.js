import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { config, plans } from './config.js';
import { setTicketRole } from './store.js';
import { supportButtons, supportSelectMenu, supportPanelEmbed, handleNewTicketButton, handleTicketSelect, handleTicketModal, handleTicketControl } from './tickets.js';

if (!config.token) {
  console.error('DISCORD_TOKEN is missing from .env');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const staff = (i, permission) => {
  const roleOk = i.memberPermissions?.has(PermissionFlagsBits.Administrator) || config.staffRoleIds.some(id => i.member?.roles?.cache?.has(id));
  return roleOk && (!permission || i.memberPermissions?.has(permission));
};

const ephemeral = (content) => ({ content, ephemeral: true });

client.once('ready', () => console.log(`Shard Bot online as ${client.user.tag}`));

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket:select') return handleTicketSelect(interaction);
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('ticket:new:')) return handleNewTicketButton(interaction);
      if (interaction.customId.startsWith('ticket:')) return handleTicketControl(interaction);
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket:modal:')) return handleTicketModal(interaction);
    if (!interaction.isChatInputCommand()) return;

    switch (interaction.commandName) {
      case 'help':
        return interaction.reply(ephemeral('**Shard Bot**\n`/plans` `/website` `/status` `/support` `/ping`\nStaff: `/warn` `/timeout` `/kick` `/ban` `/announce`'));
      case 'plans': {
        const embed = new EmbedBuilder().setTitle('Shard Hosting Plans').setDescription(config.launchStatus === 'prelaunch' ? '🚧 **Launching soon**' : 'Choose a plan that fits your server.');
        for (const p of plans) embed.addFields({ name: `${p.name} • ${p.ram} • ${p.price}`, value: p.for });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      case 'website':
        return interaction.reply(ephemeral(config.websiteUrl || 'Website is not configured yet.'));
      case 'panel':
        return interaction.reply(ephemeral(config.launchStatus === 'live' && config.panelUrl ? config.panelUrl : 'The game panel is not live yet.'));
      case 'billing':
        return interaction.reply(ephemeral(config.launchStatus === 'live' && config.billingUrl ? config.billingUrl : 'Billing is not live yet.'));
      case 'status': {
        const lines = [
          `Launch: **${config.launchStatus}**`,
          `Bot: **Online**`,
          `Maintenance: **${config.maintenance ? 'Yes' : 'No'}**`
        ];
        if (config.maintenance) lines.push(config.maintenanceMessage);
        return interaction.reply(ephemeral(lines.join('\n')));
      }
      case 'ticket-role': {
        if (!staff(interaction, PermissionFlagsBits.ManageGuild)) return interaction.reply(ephemeral('You do not have permission to use this command.'));
        const category = interaction.options.getString('category', true);
        const role = interaction.options.getRole('role', true);
        setTicketRole(interaction.guildId, category, role.id);
        return interaction.reply(ephemeral(`✅ ${category} tickets will ping ${role}.`));
      }
      case 'ping':
        return interaction.reply(ephemeral(`🏓 ${client.ws.ping}ms`));
      case 'support': {
        const embed = supportPanelEmbed().setTitle('Shard Hosting Support');
        return interaction.reply({ embeds: [embed], components: [supportSelectMenu()], ephemeral: true });
      }
      case 'ticket-panel':
      case 'support-panel': {
        if (!staff(interaction, PermissionFlagsBits.ManageGuild)) return interaction.reply(ephemeral('You do not have permission to use this command.'));
        if (!interaction.channel?.isTextBased()) return interaction.reply(ephemeral('Use this command in a text channel.'));
        await interaction.channel.send({ embeds: [supportPanelEmbed()], components: [supportSelectMenu()] });
        return interaction.reply(ephemeral('✅ Ticket panel posted.'));
      }
      case 'warn': {
        if (!staff(interaction, PermissionFlagsBits.ModerateMembers)) return interaction.reply(ephemeral('You do not have permission to use this command.'));
        const user = interaction.options.getUser('member', true);
        const reason = interaction.options.getString('reason', true);
        await user.send(`You were warned in **${interaction.guild.name}**. Reason: ${reason}`).catch(() => null);
        await logMod(interaction, 'Warn', user, reason);
        return interaction.reply(ephemeral(`Warned ${user.tag}.`));
      }
      case 'timeout': {
        if (!staff(interaction, PermissionFlagsBits.ModerateMembers)) return interaction.reply(ephemeral('You do not have permission to use this command.'));
        const user = interaction.options.getUser('member', true);
        const member = await interaction.guild.members.fetch(user.id);
        const minutes = interaction.options.getInteger('minutes', true);
        const reason = interaction.options.getString('reason', true);
        await member.timeout(minutes * 60_000, reason);
        await logMod(interaction, `Timeout ${minutes}m`, user, reason);
        return interaction.reply(ephemeral(`Timed out ${user.tag} for ${minutes} minute(s).`));
      }
      case 'kick': {
        if (!staff(interaction, PermissionFlagsBits.KickMembers)) return interaction.reply(ephemeral('You do not have permission to use this command.'));
        const user = interaction.options.getUser('member', true);
        const member = await interaction.guild.members.fetch(user.id);
        const reason = interaction.options.getString('reason', true);
        await member.kick(reason);
        await logMod(interaction, 'Kick', user, reason);
        return interaction.reply(ephemeral(`Kicked ${user.tag}.`));
      }
      case 'ban': {
        if (!staff(interaction, PermissionFlagsBits.BanMembers)) return interaction.reply(ephemeral('You do not have permission to use this command.'));
        const user = interaction.options.getUser('member', true);
        const reason = interaction.options.getString('reason', true);
        await interaction.guild.members.ban(user.id, { reason });
        await logMod(interaction, 'Ban', user, reason);
        return interaction.reply(ephemeral(`Banned ${user.tag}.`));
      }
      case 'announce': {
        if (!staff(interaction, PermissionFlagsBits.ManageGuild)) return interaction.reply(ephemeral('You do not have permission to use this command.'));
        if (!config.announcementChannelId) return interaction.reply(ephemeral('ANNOUNCEMENT_CHANNEL_ID is not configured.'));
        const channel = await interaction.guild.channels.fetch(config.announcementChannelId).catch(() => null);
        if (!channel?.isTextBased()) return interaction.reply(ephemeral('Announcement channel is invalid.'));
        const title = interaction.options.getString('title', true);
        const message = interaction.options.getString('message', true);
        await channel.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(message).setTimestamp()], allowedMentions: { parse: [] } });
        return interaction.reply(ephemeral('Announcement posted.'));
      }
    }
  } catch (error) {
    console.error('Interaction error:', error?.name ?? 'Error');
    const msg = 'Something went wrong while handling that action.';
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content: msg, ephemeral: true }).catch(() => null);
    else await interaction.reply({ content: msg, ephemeral: true }).catch(() => null);
  }
});

async function logMod(interaction, action, user, reason) {
  if (!config.modLogChannelId) return;
  const ch = await interaction.guild.channels.fetch(config.modLogChannelId).catch(() => null);
  if (!ch?.isTextBased()) return;
  await ch.send({ embeds: [new EmbedBuilder().setTitle(`Moderation: ${action}`).addFields(
    { name: 'Target', value: `${user.tag} (${user.id})` },
    { name: 'Staff', value: `${interaction.user.tag} (${interaction.user.id})` },
    { name: 'Reason', value: reason }
  ).setTimestamp()] }).catch(() => null);
}

await client.login(config.token);
