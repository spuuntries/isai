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
async function exceptionChange(guildConf, newval, interaction, db, logChannel) {
  if (!newval) {
    await interaction.reply({
      content: `Current exception for ${interaction.guild.name} is: **${guildConf.config.exception}%**`,
      ephemeral: true,
    });
    return;
  } else {
    let newrole = await interaction.guild.roles.fetch(newval);
    if (isNaN(newval) || !newrole) {
      await interaction.reply({
        content: `Invalid new exception role!\nValue must be a valid role ID.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    try {
      let newConf = { ...guildConf };
      newConf["config"]["exception"] = newval;
      await db.set(interaction.guildId, newConf);
      await interaction.editReply({
        content: `Changed exception for ${interaction.guild.name} to **${newrole.name}(${newval})**`,
      });
      await logChannel.send({
        content: `${interaction.user.tag}(${interaction.user.id}) changed the exception for this server to ${newrole.name}(${newval})`,
      });
    } catch (error) {
      logger(
        `Failed to change exception for ${interaction.guild.name}(${interaction.guildId}), ${error}`
      );
      await interaction.editReply({
        content:
          `An error occurred while changing the exception for **${interaction.guild.name}**!\n` +
          `Try again, please contact support if this persists.`,
      });
    }
  }
}
export { exceptionChange };
