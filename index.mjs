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
  db = new QuickDB();

client.on("guildCreate", async (guild) => {
  const logChannel = await guild.channels.create({ name: "isai-logs" });
  if (!(await db.has(guild.id)))
    await db.set(guild.id, {
      obj: guild,
      config: { threshold: 80, exception: [], log: logChannel.id },
    });
});

client.on("messageCreate", async (message) => {
  const guildConfig = await db.get(message.guild.id),
    /** @type {Discord.TextChannel} */
    logChannel = await client.channels.fetch(guildConfig.config.log),
    attArray = Array.from(message.attachments);

  if (procenv.EXCEPTION)
    if (procenv.EXCEPTION.split(",").includes(message.author.id)) return;

  if (
    (await message.guild.members.fetch(message.author.id)).roles.cache.some(
      (r) => guildConfig.config.exception.includes(r.id)
    )
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
            `${prob}% is above the configured ${guildConfig.config.threshold}% threshold on this guild.`
          )
          .setThumbnail(a[1].url)
          .setTimestamp()
          .setFooter(
            `- Message ID: ${message.id} - Posted ${
              Date.now() - message.createdTimestamp
            }s ago.`
          );

      if (prob >= guildConfig.config.threshold)
        logChannel.send({ embeds: [embed] });
    });
  }
});

client.login(procenv.TOKEN);
