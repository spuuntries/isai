import * as Discord from "discord.js";
import * as dotenv from "dotenv";
import { thresholdChange } from "./commands/config/threshold";
import { QuickDB } from "quick.db";
import { scan } from "reminate";
import axios from "axios";
import { exceptionChange } from "./commands/config/exception";
import { logChange } from "./commands/config/logchan";

dotenv.config();

const procenv = process.env,
  client = new Discord.Client({
    intents: ["GuildMessages", "MessageContent", "Guilds"],
  }),
  db = new QuickDB(),
  logger = (message) => console.log(`[${new Date()}] | ${message}`);

client.on("ready", async () => {
  if (!(await db.has("log"))) db.set("log", {});
});

client.on("guildCreate", async (guild) => {
  if (!(await db.has(guild.id))) {
    const channels = await guild.channels.fetch(),
      logChannel = channels.some((c) => {
        c.name == "isai-logs";
      })
        ? channels.find((c) => {
            c.name == "isai-logs";
          })
        : await guild.channels.create({ name: "isai-logs" });
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
            `Message ID: ${message.id}` +
              `\nPosted <t:${Date.now() - message.createdTimestamp}:R> ago.` +
              `\n<a:AU_AU:772657347956441098> Join Art Union, https://discord.gg/bqcsVNF`
          );

      if (prob >= guildConfig.config.threshold) {
        logChannel.send({ embeds: [embed] });
        logger(
          `Detected ${message.id} from ${message.author.id} in ${message.guild.id}`
        );
      }

      if (!(await db.get("log"))[""])
        await db.set(`log.${message.author.id}`, []);
      await db.push(`log.${message.author.id}`, a[1].url);

      logger(
        `Processed ${message.id} from ${message.author.id} in ${message.guild.id}`
      );
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
                inline: true,
              };
            })
          )
          .setTimestamp()
          .setFooter({
            text: `<a:AU_AU:772657347956441098> Join Art Union, https://discord.gg/bqcsVNF`,
          });
        await interaction.reply({ embeds: [embed] });
      }

      switch (op) {
        case "threshold":
          await thresholdChange(guildConf, newval, interaction, db, logChannel);
          break;

        case "exception":
          await exceptionChange(guildConf, newval, interaction, db, logChannel);
          break;

        case "log":
          await logChange(guildConf, newval, interaction, db, logChannel);
          break;

        default:
          await interaction.reply({
            content:
              `Option \`${op}\` unknown!\n` + `Recheck and retry the command.`,
          });
          break;
      }
      break;

    case "support":
      let embed = new Discord.EmbedBuilder()
        .setTitle("💬 Isai Support")
        .setDescription(`FAQ:`)
        .setFields([
          {
            name: "How does this bot work?",
            value:
              `Our bot interfaces with [**Illuminarty**](https://illuminarty.ai) to determine if an artwork is AI-generated.\n` +
              `(To clarify, we are **not** an official bot from Illuminarty, we are simply interfacing with their service)`,
            inline: true,
          },
          {
            name: "Are my images stored in a database?",
            value:
              `We do **not** store any of the materials we process for any longer than the duration __necessary__ to process them.\n` +
              `However, as we interface with [**Illuminarty**](https://illuminarty.ai) to process works, ` +
              `we suggest you check their [privacy policy](https://illuminarty.ai/privacy).`,
            inline: true,
          },
          {
            name: "Is this bot open-source? Can I contribute?",
            value:
              `Yes! Here's the [source code](https://github.com/spuuntries/isai).\n` +
              `Contributions are welcome! 🤗`,
            inline: true,
          },
          {
            name: "Is there a support server?",
            value:
              `Here: []().\n` + // TODO: Add link, make server
              `The bot is currently being solo-developed by kek/spuun, you can contact him at kkekkyea#4686 on Discord and kek@spuun.art.`,
            inline: true,
          },
          // TODO: A longer FAQ, website on github.io mabi
        ]);
      interaction.reply({ embeds: [embed], ephemeral: true });
      break;

    default:
      break;
  }
});

client.login(procenv.TOKEN);
