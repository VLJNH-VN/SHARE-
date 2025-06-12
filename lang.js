
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "..", "data", "langprefs.json");

if (!fs.existsSync(path.dirname(file))) fs.mkdirSync(path.dirname(file));
if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({}), "utf8");

module.exports.config = {
  name: "lang",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Ljzi",
  description: "Chọn ngôn ngữ dịch quote cho nhóm",
  commandCategory: "Tiện ích",
  usages: "/lang [vi|en|ja|zh|fr|...]",
  cooldowns: 5
};

module.exports.run = function ({ api, event, args }) {
  const { threadID } = event;
  const langCode = args[0];

  if (!langCode) return api.sendMessage("❎ Vui lòng nhập mã ngôn ngữ (ví dụ: vi, en, ja, zh)", threadID);

  const langs = JSON.parse(fs.readFileSync(file, "utf8"));
  langs[threadID] = langCode;
  fs.writeFileSync(file, JSON.stringify(langs, null, 2), "utf8");

  return api.sendMessage(`✅ Ngôn ngữ quote đã được cập nhật: ${langCode}`, threadID);
};
