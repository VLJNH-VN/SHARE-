const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI('AIzaSyC5fcDng9k34rVaPbtrHoTxqBukpYfp4uQ');

async function generateMultipleChoiceQuestions(topic, count = 3) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Hãy tạo ${count} câu hỏi trắc nghiệm tiếng Hàn về chủ đề "${topic}".
Trả về kết quả dạng JSON mảng, ví dụ:
[
  {
    "question": "Từ '학교' nghĩa là gì?",
    "choices": ["Trường học", "Táo", "Quan trọng", "Bút"],
    "answer": "Trường học"
  }
]`;
        const res = await model.generateContent(prompt);
        const text = res.response.text();
        const jsonStart = text.indexOf('[');
        const jsonEnd = text.lastIndexOf(']');
        if (jsonStart >= 0 && jsonEnd >= 0) {
            const jsonString = text.substring(jsonStart, jsonEnd + 1);
            return JSON.parse(jsonString);
        }
        return [];
    } catch (e) {
        console.log('⚠️ Lỗi gọi Gemini:', e.message);
        return [];
    }
}

module.exports = { generateMultipleChoiceQuestions };
