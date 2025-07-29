const fs = require('fs');
const chalk = require('chalk');
const inquirer = require('inquirer');
const XLSX = require('xlsx');
const figlet = require('figlet');
const boxen = require('boxen');
const googleTTS = require('google-tts-api');
const open = require('open');
const dayjs = require('dayjs');
const { generateMultipleChoiceQuestions } = require('./gemini');

const vocabFile = 'vocab.xlsx';
const grammarFile = 'grammar.json';
const progressFile = 'progress.json';
const historyFile = 'history.json';
const dailyQuizFile = 'daily_quiz.json';

// Load data
function loadVocab() {
    const wb = XLSX.readFile(vocabFile);
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
}
function loadGrammar() {
    return JSON.parse(fs.readFileSync(grammarFile, 'utf8'));
}
function loadProgress() {
    if (fs.existsSync(progressFile)) return JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    return { total: 0, correct: 0, wrong: 0, wrongWords: [] };
}
function saveProgress(p) {
    fs.writeFileSync(progressFile, JSON.stringify(p, null, 2));
}
function saveHistory(date, correct, total) {
    let h = []; if (fs.existsSync(historyFile)) h = JSON.parse(fs.readFileSync(historyFile));
    h.push({ date, correct, total });
    fs.writeFileSync(historyFile, JSON.stringify(h, null, 2));
}

// Shuffle array
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];
    }
}

// Phát âm
async function speak(word) {
    try {
        const url = googleTTS.getAudioUrl(word, { lang: 'ko' }); await open(url);
    } catch { console.log(chalk.red('⚠️ Không thể phát âm.')); }
}

// Auto sync data
function autoSyncData() {
    if (fs.existsSync('vocab_update.xlsx')) {
        fs.copyFileSync('vocab_update.xlsx', vocabFile);
        console.log(chalk.green('🔄 Đã cập nhật vocab.xlsx'));
        fs.unlinkSync('vocab_update.xlsx');
    }
    if (fs.existsSync('grammar_update.json')) {
        fs.copyFileSync('grammar_update.json', grammarFile);
        console.log(chalk.green('🔄 Đã cập nhật grammar.json'));
        fs.unlinkSync('grammar_update.json');
    }
}

// Tự tạo quiz hàng ngày
async function autoCreateDailyQuiz() {
    const today = dayjs().format('YYYY-MM-DD');
    if (fs.existsSync(dailyQuizFile)) {
        const data = JSON.parse(fs.readFileSync(dailyQuizFile));
        if (data.date === today) return;
    }
    const vocab = loadVocab(); shuffle(vocab);
    const quiz = vocab.slice(0, 5); // 5 câu từ data
    const aiQuestions = await generateMultipleChoiceQuestions("Ngữ pháp định ngữ (는)", 3);
    aiQuestions.forEach(q => quiz.push({ ai: true, ...q }));
    fs.writeFileSync(dailyQuizFile, JSON.stringify({ date: today, quiz }, null, 2));
    console.log(chalk.green('✅ Đã tự tạo bài kiểm tra 15p hôm nay!'));
}

// Quiz trắc nghiệm (Hàn → Việt)
function createChoices(correct, vocab, key) {
    const choices = [correct[key]];
    while (choices.length < 4) {
        const r = vocab[Math.floor(Math.random() * vocab.length)][key];
        if (!choices.includes(r)) choices.push(r);
    }
    shuffle(choices);
    return choices;
}
async function startQuizMultipleChoice(vocab) {
    let p = loadProgress(); shuffle(vocab);
    for (const item of vocab) {
        await speak(item.kr);
        const choices = createChoices(item, vocab, 'vi');
        const { answer } = await inquirer.prompt([{ type: 'list', name: 'answer', message: `👉 "${chalk.yellow(item.kr)}" nghĩa là gì?`, choices }]);
        p.total++;
        if (answer === item.vi) { console.log(chalk.green('✅ Đúng!')); p.correct++; p.wrongWords = p.wrongWords.filter(w => w.kr !== item.kr); }
        else { console.log(chalk.red(`❌ Sai! Đáp án: ${item.vi}`)); p.wrong++; if (!p.wrongWords.find(w => w.kr === item.kr)) p.wrongWords.push(item); }
        saveProgress(p);
    }
    const percent = ((p.correct / p.total) * 100).toFixed(1);
    console.log(chalk.magenta('\n📊 Kết thúc!')); console.log(`Tổng: ${p.total}`); console.log(chalk.green(`Đúng: ${p.correct}`)); console.log(chalk.red(`Sai: ${p.wrong}`)); console.log(chalk.cyan(`🎯 Chính xác: ${percent}%`));
    saveHistory(dayjs().format('YYYY-MM-DD'), p.correct, p.total);
}

// Quiz hàng ngày
async function startDailyQuiz() {
    if (!fs.existsSync(dailyQuizFile)) {
        console.log(chalk.red('⚠️ Chưa có quiz hôm nay!')); return;
    }
    const data = JSON.parse(fs.readFileSync(dailyQuizFile));
    console.log(chalk.yellow(`\n📝 Bài kiểm tra ngày ${data.date}`));
    for (const q of data.quiz) {
        if (q.ai && q.choices) {
            const { answer } = await inquirer.prompt([{ type: 'list', name: 'answer', message: `🤖 ${q.question}`, choices: q.choices }]);
            if (answer === q.answer) console.log(chalk.green('✅ Đúng!'));
            else console.log(chalk.red(`❌ Sai! Đáp án: ${q.answer}`));
        } else {
            await speak(q.kr);
            const { answer } = await inquirer.prompt([{ type: 'input', name: 'answer', message: `👉 "${q.kr}" nghĩa là gì?` }]);
            if (answer.trim() === q.vi.trim()) console.log(chalk.green('✅ Đúng!'));
            else console.log(chalk.red(`❌ Sai! Đáp án: ${q.vi}`));
        }
    }
}

// Hiện ngữ pháp
function showGrammar() {
    const g = loadGrammar();
    console.log(chalk.yellow('\n📚 Ngữ pháp:'));
    g.forEach(item => {
        console.log(chalk.cyan(`\n🔹 ${item.name}\n${item.explain}`));
        item.examples.forEach(ex => console.log(`👉 ${ex.kr} = ${ex.vi}`));
    });
}

// Hiện lịch sử
function showHistory() {
    if (!fs.existsSync(historyFile)) { console.log(chalk.yellow('⏳ Chưa có lịch sử.')); return; }
    const h = JSON.parse(fs.readFileSync(historyFile));
    console.log(chalk.magenta('\n📅 Lịch sử học:'));
    h.forEach(i => console.log(`${i.date} → ✅ ${i.correct}/${i.total}`));
}

// Reset
function resetProgress() { saveProgress({ total: 0, correct: 0, wrong: 0, wrongWords: [] }); console.log(chalk.green('✅ Đã reset tiến trình!')); }

// Menu
async function menu() {
    console.clear();
    console.log(boxen(chalk.cyanBright(figlet.textSync('Korean Quiz', { font: 'Slant' })), { padding: 1, borderColor: 'yellow' }));
    while (1) {
        const { choice } = await inquirer.prompt([{
            type: 'list', name: 'choice', message: chalk.blueBright('\n📌 Chọn chế độ:'), choices: [
                '🎮 Quiz trắc nghiệm (Hàn → Việt)', '🧠 Quiz hàng ngày (15p)', '📅 Xem lịch sử', '📖 Xem ngữ pháp', '🔄 Reset', '❌ Thoát'
            ]
        }]);
        if (choice === '🎮 Quiz trắc nghiệm (Hàn → Việt)') {
            const v = loadVocab(); if (v.length === 0) console.log(chalk.red('⚠️ vocab.xlsx chưa có dữ liệu!')); else await startQuizMultipleChoice(v);
        } else if (choice === '🧠 Quiz hàng ngày (15p)') {
            await startDailyQuiz();
        } else if (choice === '📅 Xem lịch sử') showHistory();
        else if (choice === '📖 Xem ngữ pháp') showGrammar();
        else if (choice === '🔄 Reset') resetProgress();
        else { console.log(chalk.green('👋 Tạm biệt!')); break; }
    }
}

// Khởi động
(async () => {
    autoSyncData();
    await autoCreateDailyQuiz();
    await menu();
})();
