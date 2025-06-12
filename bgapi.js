const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "bgapi",
  version: "3.3.0",
  hasPermssion: 2,
  credits: "Ljzi",
  description: "TikTok stats",
  commandCategory: "Tiện ích",
  usages: "/bgapi [stats|list-stats|cache|config|data]",
  cooldowns: 3
};

const cachePath = path.join(__dirname, "cache");
const dataPath = path.join(__dirname, "data");
const crawlPath = path.join(dataPath, "crawltiktok.json");

if (!fs.existsSync(cachePath)) fs.mkdirSync(cachePath);
if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
if (!fs.existsSync(crawlPath)) fs.writeFileSync(crawlPath, "[]", "utf8");

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const API_KEY = global.config.BG_API_KEY || "FREE_9660F2E05862A24AA171A77330DFC74D";
  const API_BASE = "https://bg-update.onrender.com";
  const command = args[0];
  const target = args[1];

  if (!command || command === "menu") {
    const prefix = global.config.PREFIX || "/";
    const uid = `user_${senderID}`;
    return api.sendMessage(
`🎯 BG-UPDATE API Commands
━━━━━━━━━━━━━━━━━━━━
👤 User gọi bot: ${uid}
🔑 API Key: ${API_KEY.slice(0, 8)}...

📋 Danh sách:
/bgapi stats [@username]
/bgapi list-stats [uid]
/bgapi config
/bgapi cache
/bgapi data

🌐 API: ${API_BASE}`, threadID, messageID);
  }

  if (command === "config") {
    return api.sendMessage(`🔧 API Key: ${API_KEY}\n→ Reply để đổi`, threadID, (err, info) => {
      global.client.handleReply.push({
        name: module.exports.config.name,
        messageID: info.messageID,
        author: senderID,
        type: "config"
      });
    });
  }

  if (command === "cache") {
    const files = fs.readdirSync(cachePath).filter(f => f.endsWith(".mp4"));
    if (!files.length) return api.sendMessage("📂 Không có video trong cache.", threadID);
    return api.sendMessage("📁 Video trong cache:\n" + files.join("\n"), threadID);
  }

  if (command === "data") {
    const data = JSON.parse(fs.readFileSync(crawlPath, "utf8"));
    if (!data.length) return api.sendMessage("📂 Chưa có dữ liệu TikTok.", threadID);
    const last = data.slice(-5).map((v, i) => `${i + 1}. ${v.title || "Không tiêu đề"}`);
    return api.sendMessage("📝 5 video cuối:\n" + last.join("\n"), threadID);
  }
  if (command === "list-stats") {
    const uid = target || `user_${senderID}`;
    try {
      const res = await axios.get(`${API_BASE}/tiktok/list-stats`, {
        params: { uid, apikey: API_KEY }
      });

      const data = res.data;
      if (data.error) return api.sendMessage("❎ Lỗi: " + data.error, threadID);

      let msg = `📊 Thống kê UID: ${uid}\n`;
      msg += `Tổng video: ${data.total_videos || 0}\n`;
      msg += `Link tải: ${data.total_download_links || 0}\n`;
      msg += `Có download: ${data.video_with_downloads || 0}\n`;

      if (data.links_by_quality) {
        msg += `\n📁 Theo chất lượng:\n`;
        for (const [q, c] of Object.entries(data.links_by_quality)) {
          msg += `- ${q}: ${c}\n`;
        }
      }

      return api.sendMessage(msg, threadID);
    } catch (e) {
      return api.sendMessage("⚠️ Không thể kết nối tới API.", threadID);
    }
  }

  if (command === "stats") {
    if (!target || !target.startsWith("@")) {
      return api.sendMessage("❎ Vui lòng nhập username TikTok dạng @username", threadID);
    }

    const username = target.replace("@", "");
    const uid = `user_${senderID}`;

    try {
      const res = await axios.get(`${API_BASE}/tiktok/stats`, {
        params: { username, uid, apikey: API_KEY }
      });

      const data = res.data.data || res.data;
      const videos = data.videos || [];
      if (!videos.length) return api.sendMessage("Không có video nào để tải.", threadID);

      // Đọc JSON cũ và lọc video đã tải
      let existing = [];
      try { existing = JSON.parse(fs.readFileSync(crawlPath, "utf8")); } catch {}
      const existedIds = new Set(existing.map(v => v.id));
      const newVideos = videos.filter(v => !existedIds.has(v.id));

      if (!newVideos.length) return api.sendMessage("✅ Tất cả video đã được tải trước đó.", threadID);
      await api.sendMessage(`📥 Đang tải ${newVideos.length} video mới từ @${username}...`, threadID);

      let success = 0, failed = 0;

      for (let i = 0; i < newVideos.length; i++) {
        const video = newVideos[i];
        const media = video.download_urls?.medias?.find(x => x.type === "video" && x.url);
        if (!media?.url) { failed++; continue; }

        const fileName = `video_${i + 1}_${username}.mp4`;
        const filePath = path.join(cachePath, fileName);

        try {
          const resVid = await axios.get(media.url, { responseType: "arraybuffer" });
          fs.writeFileSync(filePath, resVid.data);

          await api.sendMessage({
            body: `[VIDEO ${i + 1}] ${video.title || "Không tiêu đề"}\n→ Dùng: apis add`,
            attachment: fs.createReadStream(filePath)
          }, threadID);

          fs.unlinkSync(filePath);

          // Lưu vào crawltiktok.json
          existing.push({
            id: video.id,
            title: video.title,
            url: media.url,
            username,
            time: Date.now()
          });
          fs.writeFileSync(crawlPath, JSON.stringify(existing, null, 2), "utf8");

          success++;
        } catch (err) {
          failed++;
        }
      }

      return api.sendMessage(`✅ Đã gửi ${success} video mới. ❌ Thất bại: ${failed}`, threadID);
    } catch (e) {
      return api.sendMessage("Lỗi khi lấy video từ TikTok.", threadID);
    }
  }
};
module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { body, senderID, threadID } = event;

  if (handleReply.type === "config" && senderID === handleReply.author) {
    global.config.BG_API_KEY = body;
    const configPath = path.join(__dirname, "../../../config.json");

    try {
      const file = require(configPath);
      file.BG_API_KEY = body;
      fs.writeFileSync(configPath, JSON.stringify(file, null, 2), "utf8");
    } catch (e) {}

    return api.sendMessage("✅ API Key đã được cập nhật.", threadID);
  }
};
