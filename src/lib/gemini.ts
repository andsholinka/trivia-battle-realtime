const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function generateTriviaQuestions(category: string) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY belum diset.");
  }

  const prompt = `Buat 5 soal trivia pilihan ganda berbahasa Indonesia untuk kategori: ${category}.\n\nAturan:\n- Semua soal harus relevan dengan kategori tersebut.\n- Masing-masing soal punya 4 opsi.\n- Hanya 1 jawaban benar.\n- Jawaban benar harus persis sama dengan salah satu opsi.\n- Tingkat kesulitan campuran ringan-menengah.\n- Kembalikan JSON valid saja tanpa markdown, tanpa penjelasan tambahan.\n- Format exact:\n{\n  "questions": [\n    {\n      "id": 1,\n      "category": "${category}",\n      "question": "...",\n      "options": ["...", "...", "...", "..."],\n      "answer": "..."\n    }\n  ]\n}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Gagal generate soal dari Gemini.");
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Respons Gemini kosong.");
  }

  const parsed = JSON.parse(text);
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

  if (questions.length !== 5) {
    throw new Error("Gemini tidak mengembalikan 5 soal valid.");
  }

  return questions.map((item: { id?: number; category?: string; question?: string; options?: string[]; answer?: string }, index: number) => ({
    id: index + 1,
    category: item.category?.trim() || category,
    question: item.question?.trim() || `Soal ${index + 1}`,
    options: Array.isArray(item.options) ? item.options.slice(0, 4).map((option) => String(option).trim()) : [],
    answer: item.answer?.trim() || "",
  }));
}
