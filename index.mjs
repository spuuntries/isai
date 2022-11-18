import * as Discord from "discord.js";
import * as dotenv from "dotenv";
import { QuickDB } from "quick.db";
import { scan } from "reminate";
import axios from "axios";

dotenv.config();

const procenv = process.env,
  client = new Discord.Client({
    intents: ["GuildMessages", "MessageContent", "Guilds"],
  }),
  db = new QuickDB(),
  logger = (message) => console.log(`[${new Date()}] | ${message}`);

client.on("guildCreate", async (guild) => {
  if (!(await db.has(guild.id))) {
    const logChannel = await guild.channels.create({ name: "isai-logs" });
    await db.set(guild.id, {
      obj: guild,
      config: { threshold: 80, exception: "unset", log: logChannel.id },
    });
  }
});

client.on("messageCreate", async (message) => {
  /** @type {{obj: Discord.Guild, config: {threshold: number, exception: string, log: string}}} */
  const guildConfig = await db.get(message.guild.id),
    /** @type {Discord.TextChannel} */
    logChannel = await client.channels.fetch(guildConfig.config.log),
    attArray = Array.from(message.attachments);

  if (procenv.EXCEPTION)
    if (procenv.EXCEPTION.split(",").includes(message.author.id)) return;

  if (
    message.member.roles.cache.some((r) => guildConfig.config.exception == r.id)
  )
    return;

  if (attArray.length > 0) {
    attArray.forEach(async (a) => {
      let buffer = (await axios.get(a[1].url, { responseType: "arraybuffer" }))
          .data,
        prob = await scan(buffer),
        embed = new Discord.EmbedBuilder()
          .setTitle(`${prob}% - ${message.author.tag}(${message.author.id})`)
          .setDescription(
            `${prob}% is above the configured ${guildConfig.config.threshold}% threshold on this guild.` +
              `\nModify the configured threshold using \`/config threshold <new-threshold>\``
          )
          .setThumbnail(a[1].url)
          .setTimestamp()
          .setFooter(
            `- Message ID: ${message.id} - Posted <t:${
              Date.now() - message.createdTimestamp
            }:R> ago.`
          );

      if (prob >= guildConfig.config.threshold)
        logChannel.send({ embeds: [embed] });
    });
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.channel.type == "DM")
    return;

  switch (interaction.commandName) {
    case "config":
      /** @type {{obj: Discord.Guild, config: {threshold: number, exception: string, log: string}}} */
      const guildConf = await db.get(interaction.guildId),
        /** @type {Discord.TextChannel} */
        logChannel = await client.channels.fetch(guildConfig.config.log),
        op = interaction.options.getString("option"),
        newval = interaction.options.getString("new_value");

      if (!interaction.member.permissions.toArray().includes("ManageGuild"))
        await interaction.reply({
          content:
            "Only members with `Manage Guild` permission are allowed to use this command!",
          ephemeral: true,
        });

      if (interaction.command.options.length == 0 || op == "view") {
        let embed = new Discord.EmbedBuilder()
          .setTitle(`⚙️ Isai configuration for ${interaction.guild.name}`)
          .setDescription(
            `To change the configuration, use \`/config <setting-to-change> <new-value>\`.`
          )
          .setFields(
            Object.entries(guildConf.config).map((s) => {
              return {
                title: s[0],
                value:
                  s[0] == "log"
                    ? `<#${JSON.stringify(s[1])}>`
                    : JSON.stringify(s[1]),
              };
            })
          )
          .setTimestamp();
      }

      switch (op) {
        case "threshold":
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
          break;

        case "exception":
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
              await interaction.editReply(
                `Changed exception for ${interaction.guild.name} to **${newrole.name}(${newval})**`
              );
              await logChannel.send(
                `${interaction.user.tag}(${interaction.user.id}) changed the exception for this server to ${newrole.name}(${newval})`
              );
            } catch (error) {
              logger(
                `Failed to change exception for ${interaction.guild.name}(${interaction.guildId}), ${error}`
              );
              await interaction.editReply(
                `An error occurred while changing the exception for **${interaction.guild.name}**!\n` +
                  `Try again, please contact support if this persists.`
              );
            }
          }
          break;

        case "log":
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
              await interaction.editReply(
                `Changed log channel for ${interaction.guild.name} to <#${logChannel.id}>(${logChannel.id})`
              );
              await logChannel.send(
                `${interaction.user.tag}(${interaction.user.id}) changed the exception for this server to ${newrole.name}(${newval})`
              );
            } catch (error) {
              logger(
                `Failed to change log channel for ${interaction.guild.name}(${interaction.guildId}), ${error}`
              );
              await interaction.editReply(
                `An error occurred while changing the exception for **${interaction.guild.name}**!\n` +
                  `Try again, please contact support if this persists.`
              );
            }
          }
          break;

        default:
          await interaction.reply({
            content:
              `Option \`${op}\` unknown!\n` + `Recheck and retry the command.`,
          });
          break;
      }
      break;

    default:
      break;
  }
});

client.login(procenv.TOKEN);
