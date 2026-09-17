import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { config } from './config.js';
import { createTicketRecord, findOpenTicketByUser, findTicketByChannel, updateTicket, getTicketRole } from './store.js';

const types = {
  support: { label: 'Support', emoji: '🎫', description: 'General questions and account help' },
  billing: { label: 'Billing', emoji: '💳', description: 'Payments, invoices and billing help' },
  technical: { label: 'Technical', emoji: '🛠️', description: 'Server or technical problems' },
  migration: { label: 'Migration', emoji: '🚚', description: 'Move an existing server to Shard Hosting' }
};

const safeName = (name) => name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 35) || 'user';

export function supportButtons() {
  const row = new ActionRowBuilder();
  for (const [key, data] of Object.entries(types)) {
    row.addComponents(new ButtonBuilder().setCustomId(`ticket:new:${key}`).setLabel(data.label).setEmoji(data.emoji).setStyle(ButtonStyle.Secondary));
  }
  return row;
}

export function supportSelectMenu() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket:select')
    .setPlaceholder('Select a topic...')
    .addOptions(
      Object.entries(types).map(([value, data]) => ({
        label: data.label,
        value,
        description: data.description,
        emoji: data.emoji
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

export function supportPanelEmbed() {
  return new EmbedBuilder()
    .setTitle('Open a ticket')
    .setDescription('Open a ticket to get help. Select a ticket category from the dropdown menu that matches your issue.')
    .setFooter({ text: 'Shard Hosting Support' });
}

function buildTicketModal(type) {
  const modal = new ModalBuilder().setCustomId(`ticket:modal:${type}`).setTitle(`${types[type].label} ticket`);
  const subject = new TextInputBuilder().setCustomId('subject').setLabel('Subject').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80);
  const details = new TextInputBuilder().setCustomId('details').setLabel('Describe what you need help with').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1500);
  modal.addComponents(new ActionRowBuilder().addComponents(subject), new ActionRowBuilder().addComponents(details));
  return modal;
}

export async function handleTicketSelect(interaction) {
  const type = interaction.values?.[0];
  if (!types[type]) return interaction.reply({ content: 'That ticket type is not available.', ephemeral: true });
  await interaction.showModal(buildTicketModal(type));
}

export async function handleNewTicketButton(interaction) {
  const type = interaction.customId.split(':')[2];
  if (!types[type]) return interaction.reply({ content: 'That ticket type is not available.', ephemeral: true });
  await interaction.showModal(buildTicketModal(type));
}

export async function handleTicketModal(interaction) {
  const type = interaction.customId.split(':')[2];
  if (!types[type]) return interaction.reply({ content: 'That ticket type is not available.', ephemeral: true });
  if (!config.ticketCategoryId) return interaction.reply({ content: 'Ticket category is not configured yet.', ephemeral: true });

  const existing = findOpenTicketByUser(interaction.guildId, interaction.user.id);
  if (existing) {
    const channelText = existing.channelId ? `<#${existing.channelId}>` : `ticket #${existing.id}`;
    return interaction.reply({ content: `You already have an open ticket: ${channelText}`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  const category = await interaction.guild.channels.fetch(config.ticketCategoryId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) return interaction.editReply('The configured ticket category is invalid.');

  const botId = interaction.client.user.id;
  const permissionOverwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: botId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles
      ]
    },
    ...config.staffRoleIds
      .filter(id => interaction.guild.roles.cache.has(id))
      .map(id => ({
        id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks
        ]
      }))
  ];

  const provisional = createTicketRecord({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username,
    type,
    subject: interaction.fields.getTextInputValue('subject'),
    details: interaction.fields.getTextInputValue('details'),
    createdAt: new Date().toISOString(),
    channelId: null,
    messageId: null
  });

  let channel;
  try {
    channel = await interaction.guild.channels.create({
      name: `${type}-${safeName(interaction.user.username)}-${String(provisional.id).padStart(4, '0')}`,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Shard ticket #${provisional.id} | ${types[type].label} | ${interaction.user.tag}`,
      permissionOverwrites
    });
  } catch (error) {
    updateTicket(provisional.id, { status: 'failed', closedAt: new Date().toISOString() });
    console.error('Ticket channel creation failed:', error?.name ?? 'Error');
    try {
      await interaction.editReply('I could not create the ticket channel. Make sure Shard Bot has **Manage Channels** and can access the configured ticket category.');
    } catch (_) { /* interaction may have expired */ }
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${types[type].emoji} ${types[type].label} Ticket #${provisional.id}`)
    .setDescription(provisional.details)
    .addFields(
      { name: 'Customer', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Subject', value: provisional.subject, inline: true },
      { name: 'Status', value: 'Open', inline: true }
    )
    .setTimestamp();

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
  );

  const rolePing = getTicketRole(interaction.guildId, type);
  const msg = await channel.send({
    content: `<@${interaction.user.id}>${rolePing ? ` <@&${rolePing}>` : ''}`,
    embeds: [embed],
    components: [controls],
    allowedMentions: { users: [interaction.user.id], roles: rolePing ? [rolePing] : [] }
  });

  updateTicket(provisional.id, { channelId: channel.id, messageId: msg.id });
  await interaction.editReply(`✅ Your ticket has been created: <#${channel.id}>`);
}

function isStaff(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  return config.staffRoleIds.some(id => interaction.member?.roles?.cache?.has(id));
}

export async function handleTicketControl(interaction) {
  const ticket = findTicketByChannel(interaction.channelId);
  if (!ticket) return interaction.reply({ content: 'This channel is not linked to a ticket.', ephemeral: true });

  if (interaction.customId === 'ticket:claim') {
    if (!isStaff(interaction)) return interaction.reply({ content: 'Only staff can claim tickets.', ephemeral: true });
    if (ticket.status !== 'open') return interaction.reply({ content: 'This ticket is closed.', ephemeral: true });
    if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) return interaction.reply({ content: `Already claimed by <@${ticket.claimedBy}>.`, ephemeral: true });
    updateTicket(ticket.id, { claimedBy: interaction.user.id });
    await interaction.reply({ content: `🛠️ Ticket claimed by <@${interaction.user.id}>.` });
    return;
  }

  if (interaction.customId === 'ticket:close') {
    const canClose = isStaff(interaction) || interaction.user.id === ticket.userId;
    if (!canClose) return interaction.reply({ content: 'Only the ticket owner or staff can close this ticket.', ephemeral: true });
    if (ticket.status !== 'open') return interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });
    const closedAt = new Date().toISOString();
    updateTicket(ticket.id, { status: 'closed', closedAt, closedBy: interaction.user.id });

    await interaction.channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false, AddReactions: false }).catch(() => null);
    const newName = interaction.channel.name.startsWith('closed-') ? interaction.channel.name : `closed-${interaction.channel.name}`.slice(0, 100);
    await interaction.channel.setName(newName).catch(() => null);
    if (config.closedTicketCategoryId) await interaction.channel.setParent(config.closedTicketCategoryId, { lockPermissions: false }).catch(() => null);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:delete').setLabel('Delete Ticket').setStyle(ButtonStyle.Danger)
    );
    if (ticket.messageId) {
      const original = await interaction.channel.messages.fetch(ticket.messageId).catch(() => null);
      if (original) await original.edit({ components: [row] }).catch(() => null);
    }

    await sendTicketLog(interaction, { ...ticket, status: 'closed', closedAt, closedBy: interaction.user.id }, 'Ticket closed');
    await interaction.editReply('✅ Ticket closed. The channel is now locked for the customer.');
    await interaction.channel.send({ content: `🔒 Ticket closed by <@${interaction.user.id}>. Staff can delete it when ready.` });
    return;
  }

  if (interaction.customId === 'ticket:delete') {
    if (!isStaff(interaction)) return interaction.reply({ content: 'Only staff can delete tickets.', ephemeral: true });
    if (ticket.status !== 'closed') return interaction.reply({ content: 'Close the ticket before deleting it.', ephemeral: true });
    await interaction.reply({ content: '🗑️ Deleting this ticket in 3 seconds...', ephemeral: true });
    await sendTicketLog(interaction, ticket, 'Ticket deleted');
    setTimeout(() => interaction.channel.delete(`Ticket #${ticket.id} deleted by ${interaction.user.tag}`).catch(() => null), 3000);
  }
}

async function sendTicketLog(interaction, ticket, title) {
  if (!config.ticketLogChannelId) return;
  const logChannel = await interaction.guild.channels.fetch(config.ticketLogChannelId).catch(() => null);
  if (!logChannel?.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setTitle(title)
    .addFields(
      { name: 'Ticket', value: `#${ticket.id}`, inline: true },
      { name: 'Type', value: types[ticket.type]?.label ?? ticket.type, inline: true },
      { name: 'Customer', value: `<@${ticket.userId}>`, inline: true },
      { name: 'Claimed by', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Unclaimed', inline: true },
      { name: 'Channel', value: ticket.channelId ? `<#${ticket.channelId}>` : 'Unknown', inline: true },
      { name: 'Subject', value: ticket.subject || 'N/A' }
    )
    .setTimestamp();
  await logChannel.send({ embeds: [embed] }).catch(() => null);
}
