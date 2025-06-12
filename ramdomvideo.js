
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const dataPath = path.join(__dirname, "data", "crawltiktok.json");
const indexPath = path.join(__dirname, "data", "lastIndex.txt");
const langFile = path.join(__dirname, "data", "langprefs.json");

const CATEGORIES = [
  "cuoc_song", "thanh_cong", "tinh_yeu", "nhan_sinh_quan", "ban_be",
  "gia_dinh", "hoc_tap", "cong_viec", "suc_khoe", "thoi_gian",
  "khoi_nghiep", "dong_luc", "giao_tiep", "suy_nghi_tich_cuc",
  "tu_hoc", "nang_luong_tich_cuc", "cam_xuc", "song_y_nghia"
];

async function translateText(text, targetLang = "vi") {
  try {
    const res = await axios.get("https://translate.googleapis.com/translate_a/single", {
      params: {
        client: "gtx",
        sl: "auto",
        tl: targetLang,
        dt: "t",
        q: text
      }
    });
    const translated = res.data?.[0]?.map(pair => pair[0]).join("") || null;
    return translated || text;
  } catch (err) {
    console.error("❌ Lỗi dịch quote:", err.message);
    return text;
  }
}

async function getQuote(targetLang = "vi") {
  const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  try {
    const res = await axios.get(`https://bg-update.onrender.com/quote/random?category=${cat}`);
    const quote = res.data?.quote || "Hãy sống tích cực mỗi ngày!";
    const author = res.data?.author || "";
    const translated = await translateText(quote, targetLang);
    return `🌟 Quote: ${translated}${author ? `\n— ${author}` : ""}`;
  } catch {
    return "🌟 Quote: Hãy sống tích cực mỗi ngày!";
  }
}

module.exports = async function sendVideoJob(api) {
  if (!fs.existsSync(dataPath)) return;
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  if (!data.length) return;

  let langs = {};
  if (fs.existsSync(langFile)) {
    langs = JSON.parse(fs.readFileSync(langFile, "utf8"));
  }

  let index = 0;
  if (fs.existsSync(indexPath)) {
    index = parseInt(fs.readFileSync(indexPath, "utf8") || "0");
  }
  if (index >= data.length) index = 0;

  const video = data[index];
  const threads = global.data.allThreadID || [];

  for (const threadID of threads) {
    const lang = langs[threadID] || "vi";
    const quote = await getQuote(lang);
    const msg = `📹 TikTok: ${video.tiktokurl}\n📤 Catbox: ${video.catboxurl}\n\n${quote}`;
    api.sendMessage(msg, threadID);
  }

  fs.writeFileSync(indexPath, String(index + 1), "utf8");
};
