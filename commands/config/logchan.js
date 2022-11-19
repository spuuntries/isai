import * as Discord from "discord.js";
import { QuickDB } from "quick.db";
logger = (message) => console.log(`[${new Date()}] | ${message}`);

/**
 * @param {{obj: Discord.Guild, config: {threshold: number, exception: string, log: string}}} guildConf
 * @param {string} newval
 * @param {Discord.ChatInputCommandInteraction} interaction
 * @param {QuickDB} db
 * @param {Discord.TextChannel} logChannel
 */
async function logChange(guildConf, newval, interaction, db, logChannel) {
  if (!newval) {
    await interaction.reply({
      content: `Current log channel for ${interaction.guild.name} is: <#${logChannel.id}>(${logChannel.id})`,
      ephemeral: true,
    });
    return;
  } else {
    let newchannel = await interaction.guild.channels.fetch(newval);
    if (isNaN(newval) || !newchannel) {
      await interaction.reply({
        content: `Invalid new log channel!\nValue must be a valid channel ID.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    try {
      let newConf = { ...guildConf };
      newConf["config"]["log"] = newval;
      await db.set(interaction.guildId, newConf);
      await interaction.editReply({
        content: `Changed log channel for ${interaction.guild.name} to <#${logChannel.id}>(${logChannel.id})`,
      });
      await logChannel.send({
        content: `${interaction.user.tag}(${interaction.user.id}) changed the exception for this server to ${newrole.name}(${newval})`,
      });
    } catch (error) {
      logger(
        `Failed to change log channel for ${interaction.guild.name}(${interaction.guildId}), ${error}`
      );
      await interaction.editReply({
        content:
          `An error occurred while changing the log channel for **${interaction.guild.name}**!\n` +
          `Try again, please contact support if this persists.`,
      });
    }
  }
}

export { logChange };
