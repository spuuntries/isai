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
async function thresholdChange(guildConf, newval, interaction, db, logChannel) {
  if (!newval)
    await interaction.reply({
      content: `Current threshold for ${interaction.guild.name} is: **${guildConf.config.threshold}%**`,
      ephemeral: true,
    });
  else {
    if (isNaN(newval)) {
      await interaction.reply({
        content: `Invalid new threshold!\nThreshold must be a number between 0-100.`,
        ephemeral: true,
      });
      return;
    }

    if (newval > 100 || newval < 0) {
      await interaction.reply({
        content: `Invalid new threshold!\nThreshold must be a number between 0-100.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    try {
      let newConf = { ...guildConf };
      newConf["config"]["threshold"] = newval;
      await db.set(interaction.guildId, newConf);
      await interaction.editReply(
        `Changed threshold for ${interaction.guild.name} to **${newval}%**`
      );
      await logChannel.send(
        `${interaction.user.tag}(${interaction.user.id}) changed the threshold for this server to ${newval}%`
      );
    } catch (error) {
      logger(
        `Failed to change threshold for ${interaction.guild.name}(${interaction.guildId}), ${error}`
      );
      await interaction.editReply(
        `An error occurred while changing the threshold for **${interaction.guild.name}**!\n` +
          `Try again, please contact support if this persists.`
      );
    }
  }
}

export { thresholdChange };
